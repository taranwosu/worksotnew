/**
 * Opt-in Sentry initialiser. Returns true when Sentry was initialised.
 *
 * `@sentry/react` is intentionally a runtime-optional dependency: install it
 * in the build pipeline only when VITE_SENTRY_DSN is set. We dynamic-import
 * to avoid breaking the build when the package isn't available.
 */
export async function initSentry(): Promise<boolean> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — optional runtime dependency
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: (import.meta.env.VITE_ENVIRONMENT as string | undefined) ?? "development",
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      sendDefaultPii: false,
    });
    return true;
  } catch (e) {
    // Module not present — gracefully degrade.
    // eslint-disable-next-line no-console
    console.warn("VITE_SENTRY_DSN set but @sentry/react not installed", e);
    return false;
  }
}
