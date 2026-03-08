interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getDelayWithJitter(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * config.baseDelayMs
  return Math.min(exponentialDelay + jitter, config.maxDelayMs)
}

export function isRetryableError(error: any): boolean {
  if (error?.status && RETRYABLE_STATUS_CODES.has(error.status)) return true
  if (error?.statusCode && RETRYABLE_STATUS_CODES.has(error.statusCode)) return true
  // Network errors
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') return true
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<{ result: T; retryCount: number }> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  let lastError: any

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const result = await fn()
      return { result, retryCount: attempt }
    } catch (error: any) {
      lastError = error
      if (attempt < cfg.maxRetries && isRetryableError(error)) {
        const waitMs = getDelayWithJitter(attempt, cfg)
        await delay(waitMs)
        continue
      }
      break
    }
  }

  throw lastError
}

export { DEFAULT_CONFIG }
export type { RetryConfig }
