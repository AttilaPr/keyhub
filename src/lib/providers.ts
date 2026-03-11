import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'

export const PROVIDERS = {
  openai: (key: string) => createOpenAI({ apiKey: key }),
  anthropic: (key: string) => createAnthropic({ apiKey: key }),
  google: (key: string) => createGoogleGenerativeAI({ apiKey: key }),
  mistral: (key: string) => createMistral({ apiKey: key }),
  openrouter: (key: string) =>
    createOpenAI({ apiKey: key, baseURL: 'https://openrouter.ai/api/v1' }),
} as const

export type ProviderName = keyof typeof PROVIDERS

export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
  openrouter: 'KeyHub Free',
}

/**
 * Platform-provided free models that all users can access without their own provider key.
 * The platform uses its own API key (from env vars) for these models.
 */
export const PLATFORM_FREE_MODELS: Record<string, { envKey: string; description: string }> = {
  'openrouter/free': {
    envKey: 'OPENRUTER_API_KEY',
    description:
      'Free AI model powered by KeyHub. Routes requests to available free models with smart filtering based on your needs — supports text, image understanding, tool calling, and structured outputs. 200K context window. Zero cost.',
  },
}

/** Check if a model is a platform-provided free model */
export function isPlatformFreeModel(model: string): boolean {
  return model in PLATFORM_FREE_MODELS
}

/** Get the API key for a platform-provided free model from env vars */
export function getPlatformFreeModelKey(model: string): string | null {
  const config = PLATFORM_FREE_MODELS[model]
  if (!config) return null
  return process.env[config.envKey] || null
}

import { getModelsByProvider } from '@/lib/cost-calculator'

// Fallback used before LiteLLM pricing loads
const FALLBACK_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
}

/** All known models grouped by provider — dynamic from LiteLLM with fallback */
export function getProviderModels(): Record<string, string[]> {
  const dynamic = getModelsByProvider()
  // Use dynamic if it has data, otherwise fallback
  return Object.keys(dynamic).length > 0 ? dynamic : FALLBACK_MODELS
}

/** @deprecated Use getProviderModels() instead */
export const PROVIDER_MODELS = FALLBACK_MODELS
