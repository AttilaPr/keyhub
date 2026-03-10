// LiteLLM community-maintained pricing source
const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Hardcoded fallback used before remote pricing loads (or if fetch fails)
const FALLBACK_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'o1': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'mistral-large-latest': { input: 2.00, output: 6.00 },
  'mistral-small-latest': { input: 0.20, output: 0.60 },
  'codestral-latest': { input: 0.20, output: 0.60 },
}

// Default fallback pricing for models not found anywhere (per 1M tokens)
const DEFAULT_PRICING = { input: 5.00, output: 15.00 }

// --- Cache state ---
let pricingCache: Record<string, { input: number; output: number }> | null = null
let providerMapCache: Record<string, string> | null = null
let lastFetchTime = 0
let fetchPromise: Promise<void> | null = null

interface LiteLLMModelEntry {
  input_cost_per_token?: number
  output_cost_per_token?: number
  litellm_provider?: string
  [key: string]: unknown
}

async function refreshCache(): Promise<void> {
  try {
    const res = await fetch(LITELLM_PRICING_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data: Record<string, LiteLLMModelEntry> = await res.json()
    const pricing: Record<string, { input: number; output: number }> = {}
    const providers: Record<string, string> = {}

    for (const [key, entry] of Object.entries(data)) {
      if (entry.input_cost_per_token == null || entry.output_cost_per_token == null) continue

      const inputPer1M = entry.input_cost_per_token * 1_000_000
      const outputPer1M = entry.output_cost_per_token * 1_000_000

      // Store under the raw key (e.g. "gpt-4o" or "openai/gpt-4o")
      pricing[key] = { input: inputPer1M, output: outputPer1M }

      if (entry.litellm_provider) {
        providers[key] = entry.litellm_provider
      }

      // Also store the unprefixed version so "openai/gpt-4o" can be found as "gpt-4o"
      const slashIdx = key.indexOf('/')
      if (slashIdx !== -1) {
        const shortKey = key.slice(slashIdx + 1)
        // Don't overwrite if the short key already exists (prefer the canonical entry)
        if (!pricing[shortKey]) {
          pricing[shortKey] = { input: inputPer1M, output: outputPer1M }
          if (entry.litellm_provider) providers[shortKey] = entry.litellm_provider
        }
      }
    }

    pricingCache = pricing
    providerMapCache = providers
    lastFetchTime = Date.now()
  } catch (err) {
    console.warn('[cost-calculator] Failed to fetch LiteLLM pricing, using fallback:', err)
    // Keep existing cache if we have one, otherwise leave null (fallback will be used)
  }
}

function needsRefresh(): boolean {
  return !pricingCache || Date.now() - lastFetchTime > CACHE_TTL
}

/** Fire-and-forget background refresh (non-blocking) */
function triggerRefresh(): void {
  if (needsRefresh() && !fetchPromise) {
    fetchPromise = refreshCache().finally(() => {
      fetchPromise = null
    })
  }
}

/** Await this in routes that need guaranteed fresh pricing (e.g. admin pricing list) */
export async function ensurePricingLoaded(): Promise<void> {
  if (needsRefresh()) {
    if (!fetchPromise) {
      fetchPromise = refreshCache().finally(() => {
        fetchPromise = null
      })
    }
    await fetchPromise
  }
}

/** Sync access — returns cached LiteLLM pricing or hardcoded fallback */
export function getModelPricing(): Record<string, { input: number; output: number }> {
  triggerRefresh()
  return pricingCache || FALLBACK_PRICING
}

/** Get the provider name for a model (from LiteLLM data), or undefined */
export function getModelProvider(model: string): string | undefined {
  triggerRefresh()
  return providerMapCache?.[model]
}

// Providers we support (maps LiteLLM provider names to our provider keys)
const SUPPORTED_PROVIDERS: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  vertex_ai: 'google',
  'vertex_ai-language-models': 'google',
  gemini: 'google',
  mistral: 'mistral',
}

/**
 * Returns all known models grouped by our provider keys.
 * Only includes models from providers we actually support.
 * Skips prefixed keys (e.g. "openai/gpt-4o") to avoid duplicates.
 */
export function getModelsByProvider(): Record<string, string[]> {
  const pricing = getModelPricing()
  const result: Record<string, string[]> = {}

  for (const [model, _price] of Object.entries(pricing)) {
    // Skip prefixed keys
    if (model.includes('/')) continue

    const litellmProvider = providerMapCache?.[model]
    if (!litellmProvider) continue

    const ourProvider = SUPPORTED_PROVIDERS[litellmProvider]
    if (!ourProvider) continue

    if (!result[ourProvider]) result[ourProvider] = []
    result[ourProvider].push(model)
  }

  // Sort models within each provider alphabetically
  for (const provider of Object.keys(result)) {
    result[provider].sort()
  }

  return result
}

/** Sync cost calculation — uses cached pricing with fallback */
export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const allPricing = getModelPricing()
  const pricing = allPricing[model] || DEFAULT_PRICING
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output
}
