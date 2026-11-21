// The brand intro plays once per browser session. A session cookie is shared
// by the intro (client) and the root layout's server gate, so repeat visitors
// never receive the overlay in the initial HTML. The old pre-paint script that
// mutated <html data-intro-seen> was removed: it caused a hydration mismatch
// that forced root-level suppressHydrationWarning.
export const INTRO_SEEN_KEY = 'tuw_intro_seen';

/** Persist the "seen" flag for this browser session (cookie + sessionStorage).
 *  Called only from the client when the intro finishes or is skipped. */
export function markIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Storage blocked: the intro may replay, which is harmless.
  }
  try {
    // Session cookie (no Max-Age/Expires) mirrors sessionStorage's lifetime.
    document.cookie = `${INTRO_SEEN_KEY}=1; path=/; SameSite=Lax`;
  } catch {
    // Cookies blocked: the intro may replay, which is harmless.
  }
}
