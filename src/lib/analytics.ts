/**
 * Opt-in PostHog client. `posthog-js` is a runtime-optional dependency:
 * install it in the build pipeline only when VITE_POSTHOG_KEY is set. We
 * dynamic-import so the bundle works without the package present.
 *
 * All exported functions are safe to call before init resolves — they queue
 * the call until the client is ready, or no-op if PostHog isn't configured.
 */

type PostHogLike = {
  init: (key: string, options: Record<string, unknown>) => unknown;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (id: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
};

let client: PostHogLike | null = null;
let pending: Array<() => void> = [];
let initialised = false;

export async function initAnalytics(): Promise<boolean> {
  if (initialised) return client !== null;
  initialised = true;
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — optional runtime dependency
    const mod = await import("posthog-js");
    const posthog = (mod.default ?? mod) as PostHogLike;
    posthog.init(key, {
      api_host:
        (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
        "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
      autocapture: false,
    });
    client = posthog;
    for (const fn of pending) fn();
    pending = [];
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("VITE_POSTHOG_KEY set but posthog-js not installed", e);
    return false;
  }
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (client) {
    client.capture(event, properties);
    return;
  }
  // Buffer events that fire before init resolves (e.g. early page load).
  pending.push(() => client?.capture(event, properties));
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (client) {
    client.identify(userId, traits);
    return;
  }
  pending.push(() => client?.identify(userId, traits));
}

export function resetAnalytics(): void {
  if (client) {
    client.reset();
    return;
  }
  pending.push(() => client?.reset());
}
