import fs from 'node:fs/promises';
import debug from 'debug';
import { exec } from './cmd';
import type { AclRuleType, AclConfigType } from '#db/repositories/acl/types';

const ACL_DEBUG = debug('ACL');
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
  
  let scriptContent: string;
  if (rules.length === 0) {
    ACL_DEBUG('No ACL rules found, generating default deny script');
    scriptContent = generateDefaultDenyScript(config, _interfaceId);
  } else {
    ACL_DEBUG(`Generating ACL script for ${rules.length} rules`);
    scriptContent = generateNftablesScript(config, rules, _interfaceId, _wgSubnet);
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
export async function generatePreDownScript(_interfaceId: string): Promise<string> {
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
function generateDefaultDenyScript(config: AclConfigType, interfaceId: string): string {
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
 * Generate full nftables script with port sets and rules
 */
function generateNftablesScript(
  config: AclConfigType,
  rules: AclRuleType[],
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
    const rulesByGroup = new Map<string, AclRuleType[]>();
    
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
        // TCP/UDP with port sets
        const setName = `ports_${sanitize(key)}`;
        const allPorts = groupRules.map((r) => r.ports).join(', ');
        
        // Check if we have port ranges
        const hasRanges = allPorts.includes('-');
        const flags = hasRanges ? 'flags interval; ' : '';
        
        portSets.push(`  set ${setName} { type inet_service; ${flags}elements = { ${allPorts} } }`);
        
        const comments = groupRules.map((r) => r.description || `Rule ${r.id}`).join(', ');
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
