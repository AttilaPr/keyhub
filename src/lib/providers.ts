import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'

export const PROVIDERS = {
  openai: (key: string) => createOpenAI({ apiKey: key }),
  anthropic: (key: string) => createAnthropic({ apiKey: key }),
  google: (key: string) => createGoogleGenerativeAI({ apiKey: key }),
  mistral: (key: string) => createMistral({ apiKey: key }),
} as const

export type ProviderName = keyof typeof PROVIDERS

export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
}

export const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
}
