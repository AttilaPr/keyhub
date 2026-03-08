/**
 * Load balancer for distributing requests across multiple provider keys.
 *
 * Supports three strategies:
 * - round-robin: weighted random selection based on key weights
 * - least-latency: pick key with lowest exponential moving average latency
 * - random: random selection weighted by key weights
 */

interface ProviderKeyLike {
  id: string
  weight: number
  latencyEma: number | null
}

/**
 * Weighted random selection: keys with higher weight are more likely to be picked.
 */
function weightedRandom<T extends ProviderKeyLike>(keys: T[]): T {
  const totalWeight = keys.reduce((sum, k) => sum + Math.max(1, k.weight), 0)
  let rand = Math.random() * totalWeight
  for (const key of keys) {
    rand -= Math.max(1, key.weight)
    if (rand <= 0) return key
  }
  return keys[keys.length - 1]
}

/**
 * Least-latency: pick key with the lowest exponential moving average latency.
 * Keys without latency data are treated as lowest (preferred for exploration).
 */
function leastLatency<T extends ProviderKeyLike>(keys: T[]): T {
  let best = keys[0]
  let bestLatency = best.latencyEma ?? -1

  for (let i = 1; i < keys.length; i++) {
    const key = keys[i]
    const lat = key.latencyEma ?? -1

    // Keys with no latency data (-1) are preferred (exploration)
    if (lat < 0 && bestLatency >= 0) {
      best = key
      bestLatency = lat
    } else if (bestLatency < 0 && lat >= 0) {
      // current best has no data, keep it
      continue
    } else if (lat < bestLatency) {
      best = key
      bestLatency = lat
    }
  }

  return best
}

/**
 * Select a provider key using the given routing strategy.
 *
 * @param keys - Array of provider keys (must have at least one)
 * @param strategy - "round-robin" | "least-latency" | "random"
 * @returns The selected provider key
 */
export function selectProviderKey<T extends ProviderKeyLike>(
  keys: T[],
  strategy: string,
): T {
  if (keys.length === 0) {
    throw new Error('No provider keys available')
  }

  if (keys.length === 1) {
    return keys[0]
  }

  switch (strategy) {
    case 'least-latency':
      return leastLatency(keys)
    case 'random':
      return weightedRandom(keys)
    case 'round-robin':
    default:
      // round-robin uses weighted random for stateless distribution
      return weightedRandom(keys)
  }
}

/**
 * Calculate updated exponential moving average for latency.
 * EMA = alpha * newLatency + (1 - alpha) * oldEma
 *
 * @param newLatencyMs - The new observed latency in milliseconds
 * @param oldEma - The previous EMA value (null if first measurement)
 * @param alpha - Smoothing factor (default 0.3)
 * @returns The updated EMA value
 */
export function updateLatencyEma(
  newLatencyMs: number,
  oldEma: number | null,
  alpha: number = 0.3,
): number {
  if (oldEma === null || oldEma === undefined) {
    return newLatencyMs
  }
  return alpha * newLatencyMs + (1 - alpha) * oldEma
}
