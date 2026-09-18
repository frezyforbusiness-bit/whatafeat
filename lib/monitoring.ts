/**
 * Thin Sentry wrapper so payment/webhook code can report without importing the
 * SDK everywhere. No-ops when no DSN is configured.
 */
export async function captureException(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
) {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.error(error);
    return;
  }
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.withScope((scope) => {
      if (context?.tags) {
        for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v);
      }
      if (context?.extra) {
        for (const [k, v] of Object.entries(context.extra)) scope.setExtra(k, v);
      }
      Sentry.captureException(error);
    });
  } catch {
    console.error(error);
  }
}
