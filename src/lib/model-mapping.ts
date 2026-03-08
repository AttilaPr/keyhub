/**
 * Cross-provider model equivalence mapping.
 * Used for fallback routing — when a primary provider fails,
 * we map the requested model to an equivalent model on the fallback provider.
 */

// Model equivalence tiers: models in the same tier are considered equivalent
const MODEL_TIERS: Record<string, Record<string, string>> = {
  // Tier 1: Flagship / large models
  flagship: {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    google: 'gemini-1.5-pro',
    mistral: 'mistral-large-latest',
  },
  // Tier 2: Small / fast models
  small: {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-20241022',
    google: 'gemini-2.0-flash',
    mistral: 'mistral-small-latest',
  },
}

// Build a reverse lookup: given a model ID, find its tier
const modelToTier: Record<string, string> = {}
for (const [tier, providers] of Object.entries(MODEL_TIERS)) {
  for (const [, model] of Object.entries(providers)) {
    modelToTier[model] = tier
  }
}

/**
 * Given a model ID and a target provider, return the equivalent model on the target provider.
 * Returns null if no mapping exists.
 */
export function mapModelToProvider(modelId: string, targetProvider: string): string | null {
  const tier = modelToTier[modelId]
  if (!tier) return null

  const targetModel = MODEL_TIERS[tier]?.[targetProvider]
  return targetModel ?? null
}

/**
 * Check if a model has a known mapping to a target provider.
 */
export function hasModelMapping(modelId: string, targetProvider: string): boolean {
  return mapModelToProvider(modelId, targetProvider) !== null
}
