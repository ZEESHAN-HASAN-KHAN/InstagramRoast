// Thin wrapper over the gtag.js snippet loaded in index.html. Analytics must
// never break the app: every call is a safe no-op when gtag is absent (ad
// blockers, script failed, local dev without the snippet).

type GtagValue = string | number | boolean | undefined;
// GA4's ecommerce events carry an `items` array of objects, so params can't be
// flat scalars only.
type GtagParams = Record<string, GtagValue | Record<string, GtagValue>[]>;

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
//
// `title` is for screens that aren't routes. The paywall is the one that
// matters: it renders inside /:username with no URL change, so without a
// virtual page view it exists only as an event and never appears in GA's
// "Pages and screens" report or in a path-based funnel exploration.
export function trackPageView(path: string, title?: string) {
  try {
    // GA4 reports the page from `page_location`; `page_path` is a Universal
    // Analytics holdover it mostly ignores. Sending the real href here would
    // have filed the paywall view under whichever roast URL was in the bar, so
    // the location is built from the path instead. For genuine route changes
    // path is already pathname+search, so this resolves to the same href.
    const location = new URL(path, window.location.origin).href;
    window.gtag?.("event", "page_view", {
      page_path: path,
      page_location: location,
      page_title: title ?? document.title,
    });
  } catch {
    /* ignore */
  }
}
