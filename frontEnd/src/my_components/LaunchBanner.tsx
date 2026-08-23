import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { track } from "@/lib/analytics";

// One-time launch announcement for Cosmic Match.
//
// Two things keep a banner like this from becoming permanent furniture:
//
// 1. It expires. A "NEW" badge still up six months from now reads as a dead
//    site, and nobody ever remembers to take one down. The date below is the
//    off switch, and it needs no deploy to fire.
// 2. Dismissal sticks. localStorage, not sessionStorage: a launch notice is
//    announced once, so closing it should close it for good rather than
//    returning on the next visit. RoastToast uses sessionStorage because its
//    content is different every time; this one says the same thing forever.
//
// It also renders above the navbar in document order rather than as a sticky
// or fixed element. A launch note is worth one look, not permanent screen
// space, so it scrolls away and does not fight the nav for the top edge or the
// bottom dock for the bottom one.

const DISMISS_KEY = "cosmic-launch-dismissed";

// Announcement window. After this the banner is gone for everyone, dismissed
// or not. Set generously — long enough for returning visitors to see it once,
// short enough that it cannot outlive the launch.
const SHOW_UNTIL = new Date("2026-10-15T00:00:00Z");

// Pointless on the page it advertises, and on checkout-ish flows where the
// visitor is mid-task.
const HIDE_ON = ["/cosmic-match", "/compatibilityRoast"];

export function LaunchBanner() {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Safari private mode throws on localStorage. Showing the banner is the
      // safe failure: worst case someone sees it twice.
      return false;
    }
  });

  if (dismissed || Date.now() > SHOW_UNTIL.getTime()) return null;
  if (HIDE_ON.includes(pathname)) return null;

  const dismiss = () => {
    track("launch_banner_dismissed", { surface: "cosmic_launch" });
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* nothing to persist to; the banner returns next visit */
    }
  };

  return (
    <div className="relative bg-primary text-primary-foreground border-b-2 border-foreground">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 pr-11 sm:pr-12 flex items-center justify-center gap-2 text-center">
        <span aria-hidden className="text-base leading-none shrink-0">
          🔮
        </span>
        <p className="text-xs sm:text-sm font-bold leading-tight">
          <span className="font-black uppercase tracking-wider">New:</span> Cosmic Match.
          {/* The tagline costs two extra lines at the top of a phone screen,
              which is the scarcest space on the site. The headline plus the
              link already say what it is. */}
          <span className="hidden sm:inline"> Two handles, two birthdays, one verdict.</span>{" "}
          <Link
            to="/cosmic-match"
            onClick={() => track("launch_banner_clicked", { surface: "cosmic_launch" })}
            className="underline decoration-2 underline-offset-2 hover:opacity-80 whitespace-nowrap"
          >
            Try it →
          </Link>
        </p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-1 top-1/2 -translate-y-1/2 size-9 grid place-items-center rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
      >
        <span aria-hidden className="text-sm leading-none">
          ✕
        </span>
      </button>
    </div>
  );
}
