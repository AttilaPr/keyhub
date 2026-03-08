/**
 * CIDR matching utility for IP allowlist enforcement.
 * Supports both exact IP matching and CIDR notation (e.g., 192.168.1.0/24).
 */

function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return -1
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function isIPv4(ip: string): boolean {
  return ipToLong(ip) !== -1
}

function parseCIDR(cidr: string): { network: number; mask: number } | null {
  const parts = cidr.split('/')
  if (parts.length !== 2) return null

  const ip = ipToLong(parts[0])
  if (ip === -1) return null

  const prefix = parseInt(parts[1], 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  const network = (ip & mask) >>> 0

  return { network, mask }
}

/**
 * Check if an IP address matches a single allowlist entry.
 * The entry can be an exact IP or a CIDR range.
 */
function matchesEntry(clientIp: string, entry: string): boolean {
  // Try exact match first
  if (clientIp === entry) return true

  // Try CIDR match
  if (entry.includes('/')) {
    const cidr = parseCIDR(entry)
    if (!cidr) return false

    const ip = ipToLong(clientIp)
    if (ip === -1) return false

    return ((ip & cidr.mask) >>> 0) === cidr.network
  }

  return false
}

/**
 * Check if a client IP is allowed by the allowlist.
 * Supports exact IPs and CIDR notation.
 * Returns true if the IP matches any entry in the allowlist.
 */
export function isIpAllowed(clientIp: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true
  return allowlist.some((entry) => matchesEntry(clientIp, entry.trim()))
}

/**
 * Validate an IP address or CIDR range string.
 * Returns true if the string is a valid IPv4 address or CIDR notation.
 */
export function isValidIpOrCidr(value: string): boolean {
  const trimmed = value.trim()

  // Check for CIDR notation
  if (trimmed.includes('/')) {
    return parseCIDR(trimmed) !== null
  }

  // Check for plain IPv4
  return isIPv4(trimmed)
}
