// Thin wrapper over the gtag.js snippet loaded in index.html. Analytics must
// never break the app: every call is a safe no-op when gtag is absent (ad
// blockers, script failed, local dev without the snippet).

type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params: GtagParams = {}) {
  try {
    window.gtag?.("event", event, params);
  } catch {
    /* never let telemetry throw into UI code */
  }
}

// gtag's initial config call already reports the first page view; this is for
// SPA route changes, which gtag can't see on its own.
export function trackPageView(path: string) {
  try {
    window.gtag?.("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  } catch {
    /* ignore */
  }
}
