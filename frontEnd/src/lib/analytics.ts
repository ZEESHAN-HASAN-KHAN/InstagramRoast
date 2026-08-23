// Thin wrapper over the gtag.js snippet loaded in index.html. Analytics must
// never break the app: every call is a safe no-op when gtag is absent (ad
// blockers, script failed, local dev without the snippet).
//
// ── Reporting on parameters ───────────────────────────────────────────────
// GA4 *collects* custom event parameters but will not *report* on them until
// each name is registered as a custom definition (Admin → Data display →
// Custom definitions). Until then they show as "(not set)", and registration
// is not retroactive — data collected before the dimension exists stays
// unreportable forever. Register first, then ship.
//
// Event-scoped dimensions this app relies on:
//   channel, method, source, gateway, variant, stage, tier, format,
//   board, scope, range, surface, result
// Metrics (numbers you'll want averaged rather than bucketed):
//   rating, rank, judges, cards, tiers, score
//
// ── Cosmic Match funnel ───────────────────────────────────────────────────
// Every step has an impression event as well as an action event, because a
// click count with no denominator cannot be turned into a rate. Read top to
// bottom; each line divides by the one above it.
//
//   compatibility_submitted   variant=cosmic|plain   form intent
//   cosmic_match_delivered    variant, result, score a reading actually landed
//   cosmic_prompt_shown       surface=compat_result  landed with no chart to sell
//   cosmic_prompt_submitted   variant=one|both       recovered into a cosmic run
//   deep_reading_shown        surface=cosmic         saw the locked reading
//   deep_reading_clicked      surface, variant       asked to unlock
//   paywall_shown             surface=cosmic_deep    needed to pay
//   deep_reading_delivered    result=cached|fresh    got it
//   deep_reading_failed       surface=cosmic         model output unusable
//
// Discovery surfaces feeding the top of that funnel:
//   cosmic_nudge_shown / _clicked / _dismissed   surface=roast
//   cosmic_upsell_opened                         surface=compat_upsell
//   compat_upsell_shown / _clicked               variant=cosmic|plain
//
// ── surface on the ecommerce events ───────────────────────────────────────
// view_item, checkout_opened, begin_checkout, purchase, purchase_failed,
// checkout_dismissed and paywall_abandoned all carry `surface`
// (roast | compat | cosmic_deep). Without it a purchase is just a purchase and
// revenue cannot be attributed to a product, which is the whole question.
//
// NEW custom definitions this funnel needs registering before it reports:
//   surface — dimension. NOT registered. Verified against the Admin API on
//             2026-08-23: the property has 21 event-scoped dimensions and this
//             is not among them, so the Data API rejects `customEvent:surface`
//             outright and every `surface` value collected so far is lost.
//             An earlier version of this comment asserted the opposite, which
//             is why nobody checked. Do not trust this list — list the
//             property's dimensions before assuming any name is live.
//   range   — dimension. Also emitted, also unregistered.
//   score   — metric.
//
// Keep the vocabulary small on purpose: a new param name is a new dimension
// someone has to remember to register, so prefer reusing `source`/`surface`
// over inventing `from_where`. Values are stable slugs, never button labels —
// renaming a button must not split a metric.

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
