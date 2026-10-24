import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { track } from "@/lib/analytics";
import { useSeen } from "@/hooks/useSeen";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  markWatched,
  pickVideo,
  POPUP_EVENT,
  videoThumb,
  videoUrl,
  type PopupTrigger,
  type PromoVideo,
} from "@/lib/promoVideos";

// Promos for our own YouTube videos, in three shapes:
//
//   VideoCard     inline block — "card" for open page space, "strip" for the
//                 tight spots (loading screens, error states)
//   VideoNavLink  a text link for the navbar and the footer
//   VideoPeek     a one-per-session floating thumbnail, fired by dwell time
//                 or scroll depth
//   VideoPopup    a one-per-session modal, fired by exit intent, coming back
//                 to the tab, or a result page asking for it
//
// They are styled as part of the site rather than as an ad slot — same border,
// same brutal shadow, same serif italic as everything around them — because
// the click has to come from curiosity about the hook, and anything that looks
// like a banner gets scrolled past on reflex. The small "opens YouTube" line
// stays, though: the destination should never be a surprise.
//
// Every surface reports `video_promo_shown` / `_clicked` with `surface` (where)
// and `variant` (which video id), so click-through can be read per placement
// and per video.
//
// Links always open a new tab. On the loading screens that is the point: the
// roast keeps generating behind it and is waiting when they come back.

// Distinct slot per surface so a page carrying two promos shows two different
// videos. Surfaces that never share a page can share a number.
const SLOTS = {
  roast_loading: 0,
  roast_result: 1,
  roast_failed: 0,
  compat_loading: 0,
  compat_result: 1,
  compat_failed: 0,
  home: 1,
  cosmic_page: 1,
  leaderboard: 1,
  nav: 2,
  footer: 3,
  peek: 4,
  popup: 5,
} as const;

export type PromoSurface = keyof typeof SLOTS;

function usePromo(surface: PromoSurface) {
  // Picked once per mount: re-picking on every render would swap the thumbnail
  // under the visitor's cursor the moment any parent state changed.
  const [video] = useState(() => pickVideo(SLOTS[surface]));
  const params = { surface, variant: video?.id };
  const seenRef = useSeen<HTMLAnchorElement>("video_promo_shown", params, { enabled: !!video });
  const onClick = () => {
    if (!video) return;
    track("video_promo_clicked", params);
    markWatched(video.id);
  };
  return { video, seenRef, onClick };
}

function PlayBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-8 text-xs" : "size-14 text-xl";
  return (
    <span
      aria-hidden
      className={`${box} grid place-items-center rounded-full bg-primary text-primary-foreground border-2 border-foreground shadow-[3px_3px_0_0_hsl(var(--brutal))] group-hover:scale-110 transition-transform`}
    >
      <span className="translate-x-[1px]">▶</span>
    </span>
  );
}

function Thumb({ video, size, className = "" }: { video: PromoVideo; size: "md" | "hq"; className?: string }) {
  return (
    <img
      src={videoThumb(video.id, size)}
      alt=""
      loading="lazy"
      className={`absolute inset-0 size-full object-cover group-hover:scale-105 transition-transform duration-500 ${className}`}
    />
  );
}

export function VideoCard({
  surface,
  variant = "card",
  lead,
}: {
  surface: PromoSurface;
  variant?: "card" | "strip";
  // A context line above the hook, e.g. "while the AI cooks…". It ties the
  // promo to what the visitor is doing right now, which is most of why it gets
  // read instead of skipped.
  lead?: string;
}) {
  const { video, seenRef, onClick } = usePromo(surface);
  if (!video) return null;

  if (variant === "strip") {
    return (
      <a
        ref={seenRef}
        href={videoUrl(video.id)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="group flex items-center gap-3 bg-card border-2 border-foreground rounded-2xl p-2 pr-4 shadow-[4px_4px_0_0_hsl(var(--brutal))] hover:-translate-y-0.5 transition-transform max-w-md mx-auto"
      >
        <span className="relative w-28 shrink-0 aspect-video overflow-hidden rounded-xl border-2 border-foreground bg-muted">
          <Thumb video={video} size="md" />
          <span className="absolute inset-0 grid place-items-center bg-black/15">
            <PlayBadge size="sm" />
          </span>
        </span>
        <span className="min-w-0 text-left">
          {lead && (
            <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {lead}
            </span>
          )}
          <span className="block font-serif italic font-bold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {video.hook}
          </span>
          <span className="block text-[10px] text-muted-foreground mt-0.5">▶ opens YouTube</span>
        </span>
      </a>
    );
  }

  return (
    <a
      ref={seenRef}
      href={videoUrl(video.id)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="group relative block bg-card border-2 border-foreground rounded-3xl p-3 shadow-brutal rotate-[-0.6deg] hover:rotate-0 hover:-translate-y-1 transition-transform max-w-xl mx-auto"
    >
      {lead && (
        <span className="absolute -top-3 left-5 z-10 bg-foreground text-background px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest rotate-[-3deg]">
          {lead}
        </span>
      )}
      <span className="relative block aspect-video overflow-hidden rounded-2xl border-2 border-foreground bg-muted">
        <Thumb video={video} size="hq" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute inset-0 grid place-items-center">
          <PlayBadge />
        </span>
        <span className="absolute bottom-3 left-4 right-4 font-serif italic font-bold text-white text-lg sm:text-xl leading-tight text-balance drop-shadow">
          {video.hook}
        </span>
      </span>
      <span className="flex items-center justify-between px-2 pt-2.5 pb-0.5 text-xs">
        <span className="font-bold group-hover:text-primary transition-colors">watch it →</span>
        <span className="text-muted-foreground">opens YouTube</span>
      </span>
    </a>
  );
}

export function VideoNavLink({
  surface,
  className = "",
  children,
  onNavigate,
}: {
  surface: "nav" | "footer";
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  const { video, seenRef, onClick } = usePromo(surface);
  if (!video) return null;
  return (
    <a
      ref={seenRef}
      href={videoUrl(video.id)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        onClick();
        onNavigate?.();
      }}
      className={className}
    >
      {children}
    </a>
  );
}

const PEEK_KEY = "video-peek-count";
const PEEK_DWELL_MS = 12_000;
// Scroll depth that counts as "finished the page".
const PEEK_SCROLL_DEPTH = 0.5;
// Once per page, capped per tab session: enough to be seen on every screen a
// visitor actually reads, not so often it becomes wallpaper.
const PEEK_MAX_PER_SESSION = 3;
// Long enough to be read, short enough that it never becomes furniture.
const PEEK_SHOW_MS = 14_000;
const PEEK_HIDE_ON = ["/terms", "/privacy", "/refund-policy"];

type PeekTrigger = "dwell" | "scroll";

// The floating promo. Once per page, up to three per tab session, on whichever
// trigger lands first — each one catches a different kind of visitor:
//
//   dwell   still on the page after 12s: engaged, has a moment
//   scroll  half way down a page: into the thing they came for
//
// Exit intent and tab return belong to VideoPopup: those are the moments a
// modal is worth its interruption, and two promos answering one trigger would
// stack on top of each other.
//
// It never shows while a payment screen is up ([data-paywall]) — sending
// someone to YouTube mid-checkout costs more than the view is worth. On a phone
// it drops from under the navbar like a notification, because the bottom edge
// already belongs to the roast toast, the rating ask and the cosmic nudge; on
// desktop it sits bottom-left, away from the toast on the right, and waits for
// any bottom-dock bar to clear first.
function peekCount() {
  try {
    return Number(sessionStorage.getItem(PEEK_KEY) ?? 0);
  } catch {
    return 0;
  }
}

export function VideoPeek() {
  const { pathname } = useLocation();
  const [video] = useState(() => pickVideo(SLOTS.peek));
  const [trigger, setTrigger] = useState<PeekTrigger | null>(null);
  const [visible, setVisible] = useState(false);
  // The page it last appeared on; a new route re-arms it.
  const [shownOn, setShownOn] = useState<string | null>(null);
  const blocked = PEEK_HIDE_ON.includes(pathname);

  useEffect(() => {
    if (!video || blocked || shownOn === pathname || peekCount() >= PEEK_MAX_PER_SESSION) return;

    const fire = (t: PeekTrigger) => {
      if (document.querySelector("[data-paywall], [data-video-popup]")) return;
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      if (desktop && document.querySelector("[data-bottom-dock]")) return;
      cleanup();
      setTrigger(t);
      setVisible(true);
      setShownOn(pathname);
      try {
        sessionStorage.setItem(PEEK_KEY, String(peekCount() + 1));
      } catch {
        /* shows again next page load at worst */
      }
      track("video_promo_shown", { surface: "peek", variant: video.id, source: t });
    };

    // Retried rather than one-shot: a dwell that lands while the paywall is up
    // should get another go once it is gone.
    const dwell = window.setInterval(() => fire("dwell"), PEEK_DWELL_MS);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const { scrollY, innerHeight } = window;
        const depth = (scrollY + innerHeight) / document.documentElement.scrollHeight;
        if (scrollY > innerHeight / 2 && depth > PEEK_SCROLL_DEPTH) fire("scroll");
      });
    };

    function cleanup() {
      window.clearInterval(dwell);
      window.removeEventListener("scroll", onScroll);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return cleanup;
  }, [video, blocked, pathname, shownOn]);

  // Its own effect: firing flips `shownOn`, which tears down the trigger effect
  // above, so a hide timer started in there was cancelled the instant it was
  // set and the peek never left on its own.
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => setVisible(false), PEEK_SHOW_MS);
    return () => window.clearTimeout(id);
  }, [visible]);

  if (!video || blocked) return null;

  const params = { surface: "peek", variant: video.id, source: trigger ?? undefined };

  return (
    <div
      role="complementary"
      aria-label="Video from InstaRoasts"
      aria-hidden={!visible}
      className={`fixed z-40 left-3 right-3 top-[calc(4.75rem+env(safe-area-inset-top))] md:top-auto md:right-auto md:left-6 md:bottom-6 md:w-80 transition-all duration-500 ${
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-3 md:translate-y-3 opacity-0 pointer-events-none"
      }`}
    >
      <div className="relative flex items-center gap-3 bg-card border-2 border-foreground rounded-2xl p-2 pr-10 shadow-brutal rotate-[0.5deg]">
        <a
          href={videoUrl(video.id)}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={visible ? 0 : -1}
          onClick={() => {
            track("video_promo_clicked", params);
            markWatched(video.id);
            setVisible(false);
          }}
          className="group flex items-center gap-3 min-w-0 flex-1"
        >
          <span className="relative w-24 shrink-0 aspect-video overflow-hidden rounded-xl border-2 border-foreground bg-muted">
            <Thumb video={video} size="md" />
            <span className="absolute inset-0 grid place-items-center bg-black/15">
              <PlayBadge size="sm" />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              👀 you might like this
            </span>
            <span className="block font-serif italic font-bold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {video.hook}
            </span>
          </span>
        </a>
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={() => {
            track("video_promo_dismissed", params);
            setVisible(false);
          }}
          aria-label="Dismiss video"
          className="absolute top-1 right-1 size-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

const POPUP_SESSION_KEY = "video-popup-shown";
// A dismissal buys a day of quiet. Without it a visitor who said no gets the
// same modal at the start of every visit, which is how a site earns a block.
const POPUP_SNOOZE_KEY = "video-popup-snoozed-at";
const POPUP_SNOOZE_MS = 24 * 60 * 60 * 1000;
// Away for less than this is a notification glance, not a return.
const POPUP_RETURN_MS = 8_000;
// Nobody has decided they like the site in their first 15 seconds; a modal
// before then reads as spam and costs the visit.
const POPUP_GRACE_MS = 15_000;

function popupAllowed() {
  try {
    if (sessionStorage.getItem(POPUP_SESSION_KEY) === "1") return false;
    const snoozed = Number(localStorage.getItem(POPUP_SNOOZE_KEY) ?? 0);
    return Date.now() - snoozed > POPUP_SNOOZE_MS;
  } catch {
    return true;
  }
}

// The modal promo. At most once per tab session, and never:
//   - in the first 15s of a visit
//   - over the paywall or another open dialog
//   - while the visitor is typing into a field (mid-handle is mid-task)
//   - for a video they have already clicked
//   - within a day of them dismissing it
//
// Triggers, first one wins:
//   exit          pointer heads for the tab bar (desktop): leaving anyway
//   return        back after 8s+ away. On a phone this is usually coming back
//                 from sharing the roast to Instagram, a good mood to ask in
//   after_roast / after_compat
//                 requested by the result pages once the payoff has landed
export function VideoPopup() {
  const { pathname } = useLocation();
  const [video] = useState(() => pickVideo(SLOTS.popup, { freshOnly: true }));
  const [trigger, setTrigger] = useState<PopupTrigger | null>(null);
  const [open, setOpen] = useState(false);
  const blocked = PEEK_HIDE_ON.includes(pathname);

  useEffect(() => {
    if (!video || blocked || !popupAllowed()) return;

    const mountedAt = Date.now();
    const timers: number[] = [];
    let hiddenAt = 0;

    const fire = (t: PopupTrigger) => {
      if (Date.now() - mountedAt < POPUP_GRACE_MS) return;
      if (!popupAllowed()) return;
      if (document.querySelector("[data-paywall], [role=dialog]")) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      try {
        sessionStorage.setItem(POPUP_SESSION_KEY, "1");
      } catch {
        /* could show again next page load at worst */
      }
      setTrigger(t);
      setOpen(true);
      track("video_promo_shown", { surface: "popup", variant: video.id, source: t });
    };

    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) fire("exit");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt >= POPUP_RETURN_MS) {
        // A beat after the tab repaints, so it arrives rather than being there.
        timers.push(window.setTimeout(() => fire("return"), 700));
      }
    };
    const onRequest = (e: Event) => fire((e as CustomEvent<PopupTrigger>).detail);

    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(POPUP_EVENT, onRequest);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(POPUP_EVENT, onRequest);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [video, blocked]);

  if (!video || blocked) return null;

  const params = { surface: "popup", variant: video.id, source: trigger ?? undefined };

  const watch = () => {
    track("video_promo_clicked", params);
    markWatched(video.id);
    setOpen(false);
  };

  const dismiss = () => {
    track("video_promo_dismissed", params);
    setOpen(false);
    try {
      localStorage.setItem(POPUP_SNOOZE_KEY, String(Date.now()));
    } catch {
      /* the session flag still holds it off for this visit */
    }
  };

  const tag =
    trigger === "return" ? "welcome back 👋" : trigger === "exit" ? "wait, one thing 👀" : "quick break? 🎧";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent
        data-video-popup
        className="w-[calc(100%-2rem)] max-w-md rounded-3xl border-2 border-foreground bg-card p-4 pt-7 shadow-brutal gap-3"
      >
        <span className="absolute -top-3 left-5 bg-foreground text-background px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest rotate-[-3deg]">
          {tag}
        </span>
        <DialogTitle className="font-serif italic font-bold text-xl leading-tight text-balance pr-6">
          {video.hook}
        </DialogTitle>
        <DialogDescription className="sr-only">A video from the InstaRoasts YouTube channel.</DialogDescription>

        <a
          href={videoUrl(video.id)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={watch}
          className="group relative block aspect-video overflow-hidden rounded-2xl border-2 border-foreground bg-muted"
        >
          <Thumb video={video} size="hq" />
          <span className="absolute inset-0 bg-black/15 grid place-items-center">
            <PlayBadge />
          </span>
        </a>

        <div className="flex items-center gap-2 pt-1">
          <a
            href={videoUrl(video.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={watch}
            className="flex-1 text-center bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider border-2 border-foreground shadow-[3px_3px_0_0_hsl(var(--brutal))] hover:-translate-y-0.5 transition-transform"
          >
            ▶ watch on YouTube
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
