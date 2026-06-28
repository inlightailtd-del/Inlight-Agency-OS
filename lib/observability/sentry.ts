function getSentry(): any {
  try {
    const Sentry = require('@sentry/nextjs')
    return Sentry
  } catch {
    return null
  }
}

export function captureError(error: Error, context?: Record<string, any>): void {
  const Sentry = getSentry()
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return
  Sentry.withScope((scope: any) => {
    if (context) scope.setExtras(context)
    Sentry.captureException(error)
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  const Sentry = getSentry()
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return
  Sentry.captureMessage(message, level)
}

export function setUser(userId: string, email?: string): void {
  const Sentry = getSentry()
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return
  Sentry.setUser({ id: userId, email })
}

export function startTransaction(name: string, op: string) {
  const Sentry = getSentry()
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return null
  return Sentry.startTransaction({ name, op })
}
