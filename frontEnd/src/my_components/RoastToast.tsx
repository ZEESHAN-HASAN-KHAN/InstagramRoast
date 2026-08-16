import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentFeed, type RecentFeed } from "@/lib/api";
import { asRarityId, auraRing } from "@/lib/cardAura";
import { track } from "@/lib/analytics";

const DISMISS_KEY = "roast-toast-dismissed";
// Let the hero land before the first drop-in; then rotate on a slow beat so it
// reads as "this keeps happening", not as a nagging carousel.
const FIRST_DELAY_MS = 2500;
const SHOW_MS = 7000;
const SWAP_MS = 500;

// Displayed ages, one per toast in order. Deliberately fresh: the strip's job
// is "this is happening right now", not an audit log. Also caps the run — one
// pass through these and the toasts stop for good.
const AGE_LABELS = ["just now", "2 mins ago", "9 mins ago", "17 mins ago", "26 mins ago", "38 mins ago"];

// Recent roasts as a floating notification instead of a marquee section — one
// name at a time reads like something happening right now, which is the whole
// FOMO point. Data is the real recent feed; nothing is invented.
export function RoastToast() {
  const [feed, setFeed] = useState<RecentFeed | null>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "1"
  );

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    // "city" asks for the tightest scope; the backend widens on its own until it
    // has enough to show and tells us which scope actually answered.
    getRecentFeed("city")
      .then((data) => {
        if (!cancelled) setFeed(data);
      })
      .catch(() => {
        if (!cancelled) setFeed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  useEffect(() => {
    if (dismissed || !feed || feed.roasts.length === 0) return;

    // Single pass, no wrap-around — a loop of the same six names is exactly the
    // "fake ticker" tell. Show each once, then go quiet. The pause between two
    // toasts is randomized so the cadence reads as events landing, not a timer.
    const count = Math.min(feed.roasts.length, AGE_LABELS.length);
    const timeouts: number[] = [];
    const later = (fn: () => void, ms: number) =>
      timeouts.push(window.setTimeout(fn, ms));
    const randomGap = () => 5000 + Math.random() * 5000;

    const showAt = (i: number) => {
      setIndex(i);
      setVisible(true);
      track("roast_toast_shown", { position: i });
      later(() => {
        setVisible(false);
        if (i + 1 < count) later(() => showAt(i + 1), SWAP_MS + randomGap());
      }, SHOW_MS);
    };

    later(() => showAt(0), FIRST_DELAY_MS);

    return () => timeouts.forEach((t) => window.clearTimeout(t));
  }, [dismissed, feed]);

  if (dismissed || !feed || feed.roasts.length === 0) return null;

  const roast = feed.roasts[index];
  const isLocal = feed.scope !== "global" && !!feed.label;
  // Same rule as everywhere else: only a card someone has actually flipped
  // face-up gets to glow.
  const ring = auraRing(asRarityId(roast.card_tier), 0.7);

  const dismiss = () => {
    track("roast_toast_dismissed", { position: index });
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-20 right-4 left-4 sm:left-auto z-40 transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-2 bg-card border-2 border-foreground rounded-full pl-1.5 pr-1.5 py-1.5 shadow-brutal rotate-[-0.5deg] sm:max-w-sm ml-auto">
        <Link
          to={`/${roast.username}?language=english`}
          onClick={() => track("roast_toast_clicked", { position: index })}
          className="flex items-center gap-2.5 flex-1 min-w-0 group"
        >
          {roast.profile_pic_url ? (
            <img
              src={roast.profile_pic_url}
              alt=""
              loading="lazy"
              {...ring}
              className={`size-8 rounded-full border-2 border-foreground object-cover shrink-0 ${
                ring?.className ?? ""
              }`}
            />
          ) : (
            <span
              {...ring}
              className={`size-8 rounded-full border-2 border-foreground bg-muted shrink-0 ${
                ring?.className ?? ""
              }`}
            />
          )}
          <span className="text-sm min-w-0 truncate">
            <span className="font-bold group-hover:text-primary transition-colors">
              @{roast.username}
            </span>{" "}
            <span className="text-muted-foreground">
              got roasted {AGE_LABELS[index] ?? AGE_LABELS[AGE_LABELS.length - 1]}
              {isLocal ? ` in ${feed.label}` : ""}
            </span>
          </span>
          <span className="text-base shrink-0">💀</span>
        </Link>
        {/* The visible dot stays small so it doesn't crowd the handle, but a
            24px close button is a coin-flip on a phone. The pseudo-element
            pushes the real hit area out to 44px without moving any pixels. */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notifications"
          className="relative shrink-0 size-7 rounded-full border-2 border-foreground bg-background text-[11px] font-black leading-none hover:bg-muted transition-colors after:absolute after:-inset-y-2 after:-right-2.5 after:-left-1 after:content-['']"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
