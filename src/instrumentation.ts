export async function register() {
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.KEY_ENCRYPTION_SECRET
    if (!secret || secret.length !== 64) {
      throw new Error(
        '[CRITICAL] KEY_ENCRYPTION_SECRET must be set to a 64 hex-char value in production. ' +
        'The application cannot start without a valid encryption key.'
      )
    }
  }
}
