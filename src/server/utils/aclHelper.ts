import fs from 'node:fs/promises';
import { createDebug } from 'obug';
import { exec } from './cmd';
import type { AclRuleType, AclConfigType } from '#db/repositories/acl/types';

const ACL_DEBUG = createDebug('ACL');
const ACL_SETUP_SCRIPT = '/etc/wireguard/acl-setup.sh';
const ACL_CLEANUP_SCRIPT = '/etc/wireguard/acl-cleanup.sh';
const PRIVATE_IPV4_CIDRS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '100.64.0.0/10',
  '169.254.0.0/16',
];

/**
 * Sanitize string for use in nftables set names
 * Replaces special characters with underscores
 */
function sanitize(str: string): string {
  return str.replace(/[.:/-]/g, '_');
}

/**
 * Merge a set of port specs (e.g. ["1-65535", "22,80"]) into a normalized,
 * non-overlapping element list for an nftables set. nftables interval sets
 * reject overlapping/adjacent intervals, so rules sharing src+dst+proto whose
 * ports overlap (e.g. "all ports" plus a specific port) must be coalesced.
 */
function mergePorts(portSpecs: string[]): {
  elements: string;
  hasRanges: boolean;
} {
  const intervals: [number, number][] = [];
  for (const spec of portSpecs) {
    for (const part of spec.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [a, b] = trimmed.split('-').map((p) => parseInt(p, 10));
        if (
          a !== undefined &&
          b !== undefined &&
          !Number.isNaN(a) &&
          !Number.isNaN(b)
        ) {
          intervals.push([Math.min(a, b), Math.max(a, b)]);
        }
      } else {
        const p = parseInt(trimmed, 10);
        if (!Number.isNaN(p)) intervals.push([p, p]);
      }
    }
  }

  intervals.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

  const merged: [number, number][] = [];
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1];
    // Merge overlapping or adjacent intervals
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  let hasRanges = false;
  const elements = merged
    .map(([start, end]) => {
      if (start === end) return `${start}`;
      hasRanges = true;
      return `${start}-${end}`;
    })
    .join(', ');

  return { elements, hasRanges };
}

/**
 * Apply ACL rules immediately by executing the setup script
 */
export async function applyAclRules(): Promise<void> {
  try {
    // Check if script exists
    await fs.access(ACL_SETUP_SCRIPT);

    // Execute the script to apply rules immediately
    ACL_DEBUG('Applying ACL rules immediately');
    await exec(`bash ${ACL_SETUP_SCRIPT}`);
    ACL_DEBUG('ACL rules applied successfully');
  } catch {
    // If script doesn't exist, ACL might be disabled - clean up rules
    ACL_DEBUG('ACL script not found, cleaning up any existing rules');
    try {
      await exec('nft delete table ip wg_acl_v4 2>/dev/null || true');
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Write ACL scripts to files and return hook commands to execute them
 */

/**
 * Generate and write the PostUp script, return command to execute it
 */
export async function generatePostUpScript(
  _interfaceId: string,
  _wgSubnet: string
): Promise<string> {
  const config = await Database.acl.getConfig(_interfaceId);

  if (!config.enabled) {
    ACL_DEBUG('ACL disabled, removing setup script and cleaning up rules');
    try {
      // Clean up existing nftables rules
      await exec('nft delete table ip wg_acl_v4 2>/dev/null || true');
      ACL_DEBUG('Cleaned up ACL nftables rules');
    } catch {
      // Ignore if cleanup fails
    }
    try {
      await fs.unlink(ACL_SETUP_SCRIPT);
    } catch {
      // Ignore if file doesn't exist
    }
    return '';
  }

  const rules = await Database.acl.getEnabledRules(_interfaceId);
  const groupMembers = await Database.acl.resolveGroupMembers(
    _interfaceId,
    _wgSubnet
  );

  // Expand group-backed rule sides into concrete CIDR pairs
  const expandedRules = expandRules(rules, groupMembers);

  let scriptContent: string;
  if (expandedRules.length === 0) {
    ACL_DEBUG('No effective ACL rules found, generating default deny script');
    scriptContent = generateDefaultDenyScript(config, _interfaceId);
  } else {
    ACL_DEBUG(
      `Generating ACL script for ${expandedRules.length} expanded rule(s)`
    );
    scriptContent = generateNftablesScript(
      config,
      expandedRules,
      _interfaceId,
      _wgSubnet
    );
  }

  // Write script to file with shebang
  const fullScript = `#!/usr/bin/env bash\nset -e\n\n${scriptContent}`;
  await fs.writeFile(ACL_SETUP_SCRIPT, fullScript, { mode: 0o755 });
  ACL_DEBUG(`Wrote ACL setup script to ${ACL_SETUP_SCRIPT}`);

  // Return command to execute the script
  return ACL_SETUP_SCRIPT;
}

/**
 * Generate and write the PreDown script, return command to execute it
 */
export async function generatePreDownScript(
  _interfaceId: string
): Promise<string> {
  const config = await Database.acl.getConfig(_interfaceId);

  if (!config.enabled) {
    ACL_DEBUG('ACL disabled, removing cleanup script if exists');
    try {
      await fs.unlink(ACL_CLEANUP_SCRIPT);
    } catch {
      // Ignore if file doesn't exist
    }
    return '';
  }

  const scriptContent = `#!/usr/bin/env bash\nset -e\n\nnft delete table ip wg_acl_v4 2>/dev/null || true`;
  await fs.writeFile(ACL_CLEANUP_SCRIPT, scriptContent, { mode: 0o755 });
  ACL_DEBUG(`Wrote ACL cleanup script to ${ACL_CLEANUP_SCRIPT}`);

  // Return command to execute the script
  return ACL_CLEANUP_SCRIPT;
}

/**
 * Generate default deny-all script when no rules exist
 */
function generateDefaultDenyScript(
  config: AclConfigType,
  interfaceId: string
): string {
  const privateSet = config.allowPublicEgress
    ? `  set private_ipv4 { type ipv4_addr; flags interval; elements = { ${PRIVATE_IPV4_CIDRS.join(', ')} } }\n`
    : '';
  const publicEgressRule = config.allowPublicEgress
    ? `    iifname "${interfaceId}" oifname "${interfaceId}" ip daddr != @private_ipv4 accept comment "Allow public egress"\n`
    : '';
  return `nft delete table ip ${config.filterTableName} 2>/dev/null || true
nft -f - <<'EOF'
table ip ${config.filterTableName} {
${privateSet}  chain forward {
    type filter hook forward priority 0;
    policy ${config.defaultPolicy};
    ct state established,related accept
    iifname "${interfaceId}" oifname != "${interfaceId}" accept comment "Allow egress traffic"
${publicEgressRule}  }
}
EOF`;
}

/**
 * A rule whose source/destination are concrete CIDRs (groups already expanded)
 */
interface ExpandedRule {
  id: number;
  sourceCidr: string;
  destinationCidr: string;
  protocol: string;
  ports: string;
  description: string;
}

type ResolvedGroups = Map<number, { name: string; cidrs: string[] }>;

/**
 * Resolve a rule side to a list of CIDRs: a group expands to its members,
 * a plain CIDR yields itself, and an empty/unresolvable side yields nothing.
 */
function resolveSide(
  cidr: string | null,
  groupId: number | null,
  groups: ResolvedGroups
): string[] {
  if (groupId !== null && groupId !== undefined) {
    return groups.get(groupId)?.cidrs ?? [];
  }
  if (cidr) {
    return [cidr];
  }
  return [];
}

/**
 * Expand each rule into concrete source/destination CIDR pairs (cartesian
 * product of both sides), deduping identical (src, dst, proto, ports) entries.
 * A rule referencing an empty group produces no entries (denied by default).
 */
function expandRules(
  rules: AclRuleType[],
  groups: ResolvedGroups
): ExpandedRule[] {
  const expanded: ExpandedRule[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const sources = resolveSide(rule.sourceCidr, rule.sourceGroupId, groups);
    const dests = resolveSide(
      rule.destinationCidr,
      rule.destinationGroupId,
      groups
    );
    if (sources.length === 0 || dests.length === 0) {
      continue;
    }

    const srcGroupName =
      rule.sourceGroupId !== null
        ? groups.get(rule.sourceGroupId)?.name
        : undefined;
    const dstGroupName =
      rule.destinationGroupId !== null
        ? groups.get(rule.destinationGroupId)?.name
        : undefined;
    const baseDesc = rule.description || `Rule ${rule.id}`;
    const tags: string[] = [];
    if (srcGroupName) tags.push(`src:${srcGroupName}`);
    if (dstGroupName) tags.push(`dst:${dstGroupName}`);
    const description = tags.length
      ? `${baseDesc} [${tags.join(', ')}]`
      : baseDesc;

    // A rule may target several protocols (comma-separated); emit one entry per
    // protocol so the existing per-protocol grouping / port-set logic applies.
    const protocols = rule.protocol
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    for (const protocol of protocols) {
      for (const sourceCidr of sources) {
        for (const destinationCidr of dests) {
          const key = `${sourceCidr}|${destinationCidr}|${protocol}|${rule.ports}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          expanded.push({
            id: rule.id,
            sourceCidr,
            destinationCidr,
            protocol,
            ports: rule.ports,
            description,
          });
        }
      }
    }
  }

  return expanded;
}

/**
 * Generate full nftables script with port sets and rules
 */
function generateNftablesScript(
  config: AclConfigType,
  rules: ExpandedRule[],
  interfaceId: string,
  _wgSubnet: string
): string {
  const portSets: string[] = [];
  const ruleLines: string[] = [];
  const privateSet = config.allowPublicEgress
    ? `  set private_ipv4 { type ipv4_addr; flags interval; elements = { ${PRIVATE_IPV4_CIDRS.join(', ')} } }\n`
    : '';
  const publicEgressRule = config.allowPublicEgress
    ? `    iifname "${interfaceId}" oifname "${interfaceId}" ip daddr != @private_ipv4 accept comment "Allow public egress"\n`
    : '';

  // Group rules by src+dst+proto to create port sets
  const rulesByGroup = new Map<string, ExpandedRule[]>();

  for (const rule of rules) {
    const key = `${rule.sourceCidr}_${rule.destinationCidr}_${rule.protocol}`;
    const existing = rulesByGroup.get(key) || [];
    existing.push(rule);
    rulesByGroup.set(key, existing);
  }

  // Generate port sets and rules for each group
  for (const [key, groupRules] of rulesByGroup.entries()) {
    const firstRule = groupRules[0];
    if (!firstRule) continue;

    if (firstRule.protocol === 'icmp') {
      // ICMP doesn't use ports
      ruleLines.push(
        `    iifname "${interfaceId}" oifname "${interfaceId}" ip saddr ${firstRule.sourceCidr} ip daddr ${firstRule.destinationCidr} ip protocol icmp accept comment "${firstRule.description || 'ACL rule ' + firstRule.id}"`
      );
    } else {
      // TCP/UDP with port sets (merge overlapping ranges across rules)
      const setName = `ports_${sanitize(key)}`;
      const { elements: allPorts, hasRanges } = mergePorts(
        groupRules.map((r) => r.ports)
      );
      const flags = hasRanges ? 'flags interval; ' : '';

      portSets.push(
        `  set ${setName} { type inet_service; ${flags}elements = { ${allPorts} } }`
      );

      const comments = groupRules
        .map((r) => r.description || `Rule ${r.id}`)
        .join(', ');
      ruleLines.push(
        `    iifname "${interfaceId}" oifname "${interfaceId}" ip saddr ${firstRule.sourceCidr} ip daddr ${firstRule.destinationCidr} ${firstRule.protocol} dport @${setName} accept comment "${comments}"`
      );
    }
  }

  return `nft delete table ip ${config.filterTableName} 2>/dev/null || true
nft -f - <<'EOF'
table ip ${config.filterTableName} {
${portSets.length > 0 ? portSets.join('\n') + '\n' : ''}${privateSet}  chain forward {
    type filter hook forward priority 0;
    policy ${config.defaultPolicy};
    ct state established,related accept
    iifname "${interfaceId}" oifname != "${interfaceId}" accept comment "Allow egress traffic"
${publicEgressRule}${ruleLines.join('\n')}
  }
}
EOF`;
}

/**
 * Validate that the generated script is safe to execute
 */
export function validateScript(script: string): boolean {
  // Basic safety checks
  if (script.includes('rm -rf') || script.includes('dd if=')) {
    throw new Error('Unsafe script detected');
  }

  // Check for proper nft syntax
  if (!script.includes('nft') && script.trim().length > 0) {
    throw new Error('Invalid script: missing nft commands');
  }

  return true;
}
