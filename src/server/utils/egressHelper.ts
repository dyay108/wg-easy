import debug from 'debug';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from './cmd';
import type { ClientType } from '#db/repositories/client/types';

const EGRESS_DEBUG = debug('Egress');
const EXIT_NODES_DIR = '/etc/wireguard/exit_nodes';
const EGRESS_SETUP_SCRIPT = '/etc/wireguard/egress-setup.sh';
const EGRESS_CLEANUP_SCRIPT = '/etc/wireguard/egress-cleanup.sh';

/**
 * Get all exit node configs from directory
 * Returns list of device names found in .conf files (regardless of up status)
 */
export async function getAllExitNodeConfigs(): Promise<string[]> {
  try {
    const files = await fs.readdir(EXIT_NODES_DIR);
    const configs = files
      .filter((file) => file.endsWith('.conf'))
      .map((file) => file.replace('.conf', ''));
    
    EGRESS_DEBUG(`Found ${configs.length} exit node configs: ${configs.join(', ')}`);
    return configs;
  } catch (error) {
    EGRESS_DEBUG('Failed to read exit nodes directory:', error);
    return [];
  }
}

/**
 * Validate and clean up client egress device assignments
 * Disables egress for clients using non-existent exit nodes
 */
export async function validateClientEgressDevices(): Promise<void> {
  try {
    EGRESS_DEBUG('Validating client egress device assignments...');
    const availableDevices = await getAllExitNodeConfigs();
    EGRESS_DEBUG('Available devices:', availableDevices);
    const clients = await Database.clients.getAll();
    
    for (const client of clients) {
      // Skip clients without egress enabled or those using default device
      if (!client.egressEnabled || !client.egressDevice) {
        continue;
      }
      
      // Check if the configured device still exists
      if (!availableDevices.includes(client.egressDevice)) {
        EGRESS_DEBUG(`Client ${client.name} (${client.id}) references missing exit node: ${client.egressDevice}. Disabling egress.`);
        try {
          await Database.clients.update(client.id, {
            name: client.name,
            enabled: client.enabled,
            expiresAt: client.expiresAt,
            ipv4Address: client.ipv4Address,
            ipv6Address: client.ipv6Address,
            preUp: client.preUp,
            postUp: client.postUp,
            preDown: client.preDown,
            postDown: client.postDown,
            allowedIps: client.allowedIps,
            serverAllowedIps: client.serverAllowedIps,
            mtu: client.mtu,
            jC: client.jC,
            jMin: client.jMin,
            jMax: client.jMax,
            i1: client.i1,
            i2: client.i2,
            i3: client.i3,
            i4: client.i4,
            i5: client.i5,
            persistentKeepalive: client.persistentKeepalive,
            serverEndpoint: client.serverEndpoint,
            dns: client.dns,
            egressEnabled: false,
            egressDevice: null,
          });
          EGRESS_DEBUG(`Successfully disabled egress for client ${client.id}`);
        } catch (updateError) {
          EGRESS_DEBUG(`Failed to update client ${client.id}:`, updateError);
        }
      }
    }
    EGRESS_DEBUG('Validation complete');
  } catch (error) {
    EGRESS_DEBUG('Failed to validate client egress devices:', error);
  }
}

// Base values for fwmark and routing table assignment
const BASE_FWMARK = 0x10; // Start at 0x10 to avoid conflicts
const BASE_RT_TABLE = 200; // Start at table 200

interface DeviceGroup {
  device: string;
  clientIps: string[];
  fwmark: string;
  rtTable: number;
}

/**
 * Check if a device has an IP address assigned
 */
async function hasIpAddress(device: string): Promise<boolean> {
  try {
    const output = await exec(`ip addr show ${device}`);
    return /inet /.test(output);
  } catch {
    return false;
  }
}

/**
 * Discover available exit node configs in /etc/wireguard/exit_nodes/
 * Returns list of device names that are UP and have IP addresses
 */
export async function discoverExitNodes(): Promise<string[]> {
  try {
    const files = await fs.readdir(EXIT_NODES_DIR);
    const configs = files
      .filter((file) => file.endsWith('.conf'))
      .map((file) => file.replace('.conf', ''));
    
    // Filter to only include devices that are up and have IPs
    const activeDevices: string[] = [];
    for (const device of configs) {
      const isUp = await isDeviceUp(device);
      const hasIp = await hasIpAddress(device);
      if (isUp && hasIp) {
        activeDevices.push(device);
      } else {
        EGRESS_DEBUG(`Device ${device} excluded: up=${isUp}, hasIp=${hasIp}`);
      }
    }
    
    EGRESS_DEBUG(`Discovered ${activeDevices.length} active exit nodes: ${activeDevices.join(', ')}`);
    return activeDevices;
  } catch (error) {
    EGRESS_DEBUG('Failed to discover exit nodes:', error);
    return [];
  }
}

/**
 * Check if a device interface is already up
 */
async function isDeviceUp(device: string): Promise<boolean> {
  try {
    await exec(`wg show ${device}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Bring up exit node WireGuard interfaces
 * Only brings up devices that are needed and not already up
 * Skips 'default' device as it uses server's default routing
 */
export async function bringUpExitNodes(devices: string[]): Promise<void> {
  for (const device of devices) {
    // Skip the special 'default' device - it uses server's default gateway
    if (device === 'default') {
      EGRESS_DEBUG('Skipping default device - uses server default routing');
      continue;
    }

    try {
      if (await isDeviceUp(device)) {
        EGRESS_DEBUG(`Device ${device} already up, skipping`);
        continue;
      }

      EGRESS_DEBUG(`Bringing up exit node: ${device}`);
      const configPath = `${EXIT_NODES_DIR}/${device}.conf`;
      await exec(`wg-quick up ${configPath}`);
      EGRESS_DEBUG(`Successfully brought up ${device}`);
    } catch (error) {
      EGRESS_DEBUG(`Failed to bring up ${device}:`, error);
      // Continue with other devices even if one fails
    }
  }
}

/**
 * Group clients by their egress device
 * Returns map of device -> client IPs, including 'default' for null device clients
 */
function groupClientsByDevice(clients: any[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const client of clients) {
    if (!client.enabled || !client.egressEnabled) {
      // Skip disabled clients and egress-disabled clients
      continue;
    }

    // Use 'default' as device name for clients with null egressDevice
    const device = client.egressDevice || 'default';
    const clientIps = groups.get(device) || [];
    clientIps.push(client.ipv4Address);
    groups.set(device, clientIps);
  }

  return groups;
}

/**
 * Assign unique fwmark and routing table to each device
 */
function assignDeviceParams(devices: string[]): DeviceGroup[] {
  return devices.map((device, index) => ({
    device,
    clientIps: [], // Will be filled later
    fwmark: `0x${(BASE_FWMARK + index).toString(16)}`,
    rtTable: BASE_RT_TABLE + index,
  }));
}

/**
 * Generate the PostUp script for egress routing
 */
export async function generateEgressPostUpScript(
  interfaceId: string,
  wgSubnet: string
): Promise<string> {
  const clients = await Database.clients.getAll();
  const clientGroups = groupClientsByDevice(clients);

  if (clientGroups.size === 0) {
    EGRESS_DEBUG('No clients with egress routing enabled');
    try {
      await fs.unlink(EGRESS_SETUP_SCRIPT);
    } catch {
      // Ignore if file doesn't exist
    }
    return '';
  }

  EGRESS_DEBUG(`Generating egress script for ${clientGroups.size} device(s)`);

  // Get unique devices
  const devices = Array.from(clientGroups.keys());
  const deviceGroups = assignDeviceParams(devices);

  // Fill in client IPs for each group
  for (const group of deviceGroups) {
    group.clientIps = clientGroups.get(group.device) || [];
  }

  // Bring up exit nodes first
  await bringUpExitNodes(devices);

  const scriptContent = generateNftablesEgressScript(
    interfaceId,
    wgSubnet,
    deviceGroups
  );

  const fullScript = `#!/usr/bin/env bash\nset -e\n\n${scriptContent}`;
  await fs.writeFile(EGRESS_SETUP_SCRIPT, fullScript, { mode: 0o755 });
  EGRESS_DEBUG(`Wrote egress setup script to ${EGRESS_SETUP_SCRIPT}`);

  return EGRESS_SETUP_SCRIPT;
}

/**
 * Generate the PreDown script for egress cleanup
 */
export async function generateEgressPreDownScript(): Promise<string> {
  const clients = await Database.clients.getAll();
  const clientGroups = groupClientsByDevice(clients);

  if (clientGroups.size === 0) {
    try {
      await fs.unlink(EGRESS_CLEANUP_SCRIPT);
    } catch {
      // Ignore if file doesn't exist
    }
    return '';
  }

  const devices = Array.from(clientGroups.keys());
  const deviceGroups = assignDeviceParams(devices);

  let scriptContent = '#!/usr/bin/env bash\nset -e\n\n';
  
  // Delete nftables table
  scriptContent += 'nft delete table ip wg_egress_nat 2>/dev/null || true\n\n';
  
  // Remove policy routing rules
  for (const group of deviceGroups) {
    scriptContent += `ip rule del fwmark ${group.fwmark} table ${group.rtTable} 2>/dev/null || true\n`;
    scriptContent += `ip route flush table ${group.rtTable} 2>/dev/null || true\n`;
  }

  await fs.writeFile(EGRESS_CLEANUP_SCRIPT, scriptContent, { mode: 0o755 });
  EGRESS_DEBUG(`Wrote egress cleanup script to ${EGRESS_CLEANUP_SCRIPT}`);

  return EGRESS_CLEANUP_SCRIPT;
}

/**
 * Generate nftables script for egress routing and NAT
 */
function generateNftablesEgressScript(
  interfaceId: string,
  wgSubnet: string,
  deviceGroups: DeviceGroup[]
): string {
  let script = '';
  
  // Start with validation and building arrays of valid device data
  script += `# Validate exit nodes\n`;
  script += `declare -A DEVICE_FWMARK\n`;
  script += `declare -A DEVICE_TABLE\n`;
  script += `declare -A DEVICE_IPS\n`;
  script += `DEFAULT_DEVICE_IPS=""\n\n`;
  
  for (const group of deviceGroups) {
    if (group.clientIps.length === 0) continue;
    
    const ipList = group.clientIps.join(' ');
    
    // Handle 'default' device specially - uses server's default routing
    if (group.device === 'default') {
      script += `# Configure default device routing\n`;
      script += `echo "Setting up default egress for ${group.clientIps.length} client(s)"\n`;
      script += `DEFAULT_DEVICE_IPS="${ipList}"\n\n`;
      continue;
    }
    
    script += `# Check ${group.device}\n`;
    script += `if wg show ${group.device} &>/dev/null && ip addr show ${group.device} | grep -q 'inet '; then\n`;
    script += `  echo "Exit node ${group.device} is active"\n`;
    script += `  DEVICE_FWMARK["${group.device}"]="${group.fwmark}"\n`;
    script += `  DEVICE_TABLE["${group.device}"]="${group.rtTable}"\n`;
    script += `  DEVICE_IPS["${group.device}"]="${ipList}"\n`;
    script += `  ip rule add fwmark ${group.fwmark} table ${group.rtTable} 2>/dev/null || true\n`;
    script += `  ip route replace default dev ${group.device} table ${group.rtTable}\n`;
    script += `else\n`;
    script += `  echo "WARNING: Exit node ${group.device} is not available. Skipping." >&2\n`;
    script += `fi\n\n`;
  }
  
  // Check if any egress is configured (either custom devices or default)
  script += `if [ \${#DEVICE_FWMARK[@]} -eq 0 ] && [ -z "$DEFAULT_DEVICE_IPS" ]; then\n`;
  script += `  echo "WARNING: No egress routing configured." >&2\n`;
  script += `  exit 0\n`;
  script += `fi\n\n`;

  // Generate nftables config dynamically
  script += `# Generate nftables configuration\n`;
  script += `nft delete table ip wg_egress_nat 2>/dev/null || true\n\n`;
  script += `{\n`;
  script += `  echo "table ip wg_egress_nat {"\n`;
  script += `  \n`;
  script += `  # Generate IP sets for each device\n`;
  script += `  \n`;
  script += `  # Default device IP set (if configured)\n`;
  script += `  if [ -n "$DEFAULT_DEVICE_IPS" ]; then\n`;
  script += `    ips_formatted=$(echo "$DEFAULT_DEVICE_IPS" | sed 's/ /, /g')\n`;
  script += `    echo "  set clients_default { type ipv4_addr; elements = { \${ips_formatted} } }"\n`;
  script += `  fi\n`;
  script += `  \n`;
  script += `  # Custom exit node IP sets\n`;
  script += `  for device in "\${!DEVICE_IPS[@]}"; do\n`;
  script += `    setname=$(echo "clients_\${device}" | sed 's/[^a-zA-Z0-9]/_/g')\n`;
  script += `    ips=\${DEVICE_IPS[$device]}\n`;
  script += `    ips_formatted=$(echo "\$ips" | sed 's/ /, /g')\n`;
  script += `    echo "  set \${setname} { type ipv4_addr; elements = { \${ips_formatted} } }"\n`;
  script += `  done\n`;
  script += `  echo ""\n`;
  script += `  \n`;
  script += `  # Prerouting chain - mark packets for policy routing\n`;
  script += `  echo "  chain prerouting {"\n`;
  script += `  echo "    type filter hook prerouting priority -149;"\n`;
  script += `  \n`;
  script += `  # Custom exit nodes get marked for policy routing\n`;
  script += `  for device in "\${!DEVICE_FWMARK[@]}"; do\n`;
  script += `    setname=$(echo "clients_\${device}" | sed 's/[^a-zA-Z0-9]/_/g')\n`;
  script += `    fwmark=\${DEVICE_FWMARK[$device]}\n`;
  script += `    echo "    iifname \\"${interfaceId}\\" ip saddr @\${setname} ip daddr != ${wgSubnet} meta mark set \${fwmark}"\n`;
  script += `  done\n`;
  script += `  \n`;
  script += `  # Default device clients - no marking needed, use normal routing\n`;
  script += `  echo "  }"\n`;
  script += `  echo ""\n`;
  script += `  \n`;
  script += `  # Forward chain\n`;
  script += `  echo "  chain forward {"\n`;
  script += `  echo "    type filter hook forward priority 1;"\n`;
  script += `  \n`;
  script += `  # Allow forwarding for custom exit nodes\n`;
  script += `  for device in "\${!DEVICE_IPS[@]}"; do\n`;
  script += `    setname=$(echo "clients_\${device}" | sed 's/[^a-zA-Z0-9]/_/g')\n`;
  script += `    echo "    iifname \\"${interfaceId}\\" oifname \\"\${device}\\" ip saddr @\${setname} accept"\n`;
  script += `  done\n`;
  script += `  \n`;
  script += `  # Allow forwarding for default device (to default interface)\n`;
  script += `  if [ -n "$DEFAULT_DEVICE_IPS" ]; then\n`;
  script += `    # Get the default route interface\n`;
  script += `    DEFAULT_IFACE=$(ip route show default | awk '/default/ {print $5}' | head -1)\n`;
  script += `    if [ -n "$DEFAULT_IFACE" ]; then\n`;
  script += `      echo "    # Forward default egress clients via \${DEFAULT_IFACE}"\n`;
  script += `      echo "    iifname \\"${interfaceId}\\" oifname \\"\${DEFAULT_IFACE}\\" ip saddr @clients_default accept"\n`;
  script += `    fi\n`;
  script += `  fi\n`;
  script += `  \n`;
  script += `  echo "  }"\n`;
  script += `  echo ""\n`;
  script += `  \n`;
  script += `  # Postrouting chain for NAT\n`;
  script += `  echo "  chain postrouting {"\n`;
  script += `  echo "    type nat hook postrouting priority 101;"\n`;
  script += `  \n`;
  script += `  # NAT for custom exit nodes\n`;
  script += `  for device in "\${!DEVICE_IPS[@]}"; do\n`;
  script += `    echo "    oifname \\"\${device}\\" masquerade"\n`;
  script += `  done\n`;
  script += `  \n`;
  script += `  # NAT for default device\n`;
  script += `  if [ -n "$DEFAULT_DEVICE_IPS" ]; then\n`;
  script += `    DEFAULT_IFACE=$(ip route show default | awk '/default/ {print $5}' | head -1)\n`;
  script += `    if [ -n "$DEFAULT_IFACE" ]; then\n`;
  script += `      echo "    # NAT for default egress via \${DEFAULT_IFACE}"\n`;
  script += `      echo "    oifname \\"\${DEFAULT_IFACE}\\" ip saddr @clients_default masquerade"\n`;
  script += `    fi\n`;
  script += `  fi\n`;
  script += `  \n`;
  script += `  echo "  }"\n`;
  script += `  \n`;
  script += `  echo "}"\n`;
  script += `} | nft -f -\n`;

  return script;
}

/**
 * Apply egress rules immediately (called after config sync)
 */
export async function applyEgressRules(): Promise<void> {
  try {
    await fs.access(EGRESS_SETUP_SCRIPT);
    EGRESS_DEBUG('Applying egress rules immediately');
    await exec(`bash ${EGRESS_SETUP_SCRIPT}`);
    EGRESS_DEBUG('Egress rules applied successfully');
  } catch (error) {
    EGRESS_DEBUG('Failed to apply egress rules:', error);
  }
}
