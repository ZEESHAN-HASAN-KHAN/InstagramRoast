import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

const DISMISS_KEY = "cosmic-nudge-dismissed";

// Sticky prompt on the roast page, pointing at the Cosmic Match card further
// down. Deliberately not a modal.
//
// A modal would be the obvious read of "popup", and it is the wrong one here.
// The audience is majority mobile and arrives from search, so an interstitial
// lands on someone who has been on the site for forty seconds and has not
// decided they like it yet. This bar sits at the bottom edge, blocks nothing,
// and scrolls to the card the visitor was already heading toward rather than
// opening a second place to do the same thing.
//
// Deferred until the visitor has scrolled: firing on mount would put it on
// screen while they are still reading their roast, which is the one moment the
// page has their full attention and the last moment worth interrupting.
export function CosmicNudge({ targetId }: { targetId: string }) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    // Once the target is on screen the visitor has arrived under their own
    // steam and the bar is redundant, so it retires rather than nagging.
    const target = document.getElementById(targetId);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(false);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    observer.observe(target);

    // Show once they are a screen and a half in: past the roast, not yet at the
    // bottom. Uses a sentinel and IntersectionObserver rather than a scroll
    // listener, which would run on every frame.
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:150vh;height:1px;width:1px;pointer-events:none";
    document.body.appendChild(sentinel);

    // The bottom edge holds one bar at a time. BurnRating's rating ask marks
    // itself data-bottom-dock and wins while it is up: it is about the roast
    // the visitor just read, and it clears the moment they answer or dismiss
    // it. Without this the two would render on top of each other, both at
    // bottom-3 z-40.
    let mutationObserver: MutationObserver | null = null;

    const reveal = () => {
      if (document.querySelector("[data-bottom-dock]")) {
        // Occupied. Wait for it to go rather than polling for it.
        if (mutationObserver) return;
        mutationObserver = new MutationObserver(() => {
          if (document.querySelector("[data-bottom-dock]")) return;
          mutationObserver?.disconnect();
          mutationObserver = null;
          reveal();
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });
        return;
      }
      setVisible(true);
      track("cosmic_nudge_shown", { surface: "roast" });
    };

    const trigger = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      trigger.disconnect();
      reveal();
    });
    trigger.observe(sentinel);

    return () => {
      observer.disconnect();
      trigger.disconnect();
      mutationObserver?.disconnect();
      sentinel.remove();
    };
  }, [dismissed, targetId]);

  if (dismissed || !visible) return null;

  const dismiss = () => {
    track("cosmic_nudge_dismissed", { surface: "roast" });
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  const go = () => {
    track("cosmic_nudge_clicked", { surface: "roast" });
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div
      data-bottom-dock
      className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      role="complementary"
      aria-label="Cosmic Match"
    >
      <div className="pointer-events-auto mx-auto max-w-lg flex items-center gap-3 bg-card border-2 border-foreground rounded-2xl p-3 shadow-brutal animate-reveal">
        <span aria-hidden className="text-2xl leading-none shrink-0 animate-float">
          🔮
        </span>

        <button
          type="button"
          onClick={go}
          className="flex-1 min-w-0 text-left cursor-pointer group"
        >
          <p className="font-serif italic font-bold text-[15px] leading-tight">
            Who are you cosmically doomed with?
          </p>
          <p className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
            add a birthday, get the full reading
          </p>
        </button>

        <button
          type="button"
          onClick={go}
          className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-black uppercase text-xs tracking-wider border-2 border-foreground shadow-[3px_3px_0_0_hsl(var(--brutal))] hover:-translate-y-0.5 transition-transform cursor-pointer"
        >
          read it
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 size-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
