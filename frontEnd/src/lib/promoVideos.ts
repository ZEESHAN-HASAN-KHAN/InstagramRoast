// House ads for our own YouTube videos. Every promo surface on the site reads
// from this one list, so adding a video here puts it everywhere at once and an
// empty list switches the whole feature off without touching a component.
//
// `hook` is the only copy the visitor sees next to the thumbnail, and it is
// what earns the click. Write it as a curiosity gap, not a description:
// "we roasted a CEO and he replied" beats "Video: Roasting Famous CEOs". Keep
// it under ~60 characters so it fits on two lines on a phone.
//
// `id` is the part after `v=` in the watch URL (or after youtu.be/).

export interface PromoVideo {
  id: string;
  hook: string;
}

export const PROMO_VIDEOS: PromoVideo[] = [
  // Prompt and Pray | The Vibe-Coding Anthem (Lyric Video)
  { id: "_ZElM8BBd0Q", hook: "a song for everyone who ships code they don't understand" },
];

// For wrappers that carry their own spacing: an empty list must not leave a
// padded blank band where the promo would have been.
export const hasPromoVideos = PROMO_VIDEOS.length > 0;

const WATCHED_KEY = "promo-watched";
const SEED_KEY = "promo-seed";

export function videoUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

// mqdefault is always 16:9 and always exists. hqdefault is sharper but is a
// 4:3 frame with letterbox bars baked in, which object-cover then crops — fine
// for the big card, wasteful for a 112px strip.
export function videoThumb(id: string, size: "md" | "hq" = "md") {
  return `https://i.ytimg.com/vi/${id}/${size === "hq" ? "hqdefault" : "mqdefault"}.jpg`;
}

function readWatched(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WATCHED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function markWatched(id: string) {
  try {
    const watched = readWatched();
    if (!watched.includes(id)) localStorage.setItem(WATCHED_KEY, JSON.stringify([...watched, id]));
  } catch {
    /* private mode: the same video may come round again, which is harmless */
  }
}

// One random offset per tab session. Without it every visitor would see video
// 0 in the first slot forever and the rest of the list would get the leftovers.
function sessionSeed() {
  try {
    const stored = sessionStorage.getItem(SEED_KEY);
    if (stored) return Number(stored);
    const seed = Math.floor(Math.random() * 1000);
    sessionStorage.setItem(SEED_KEY, String(seed));
    return seed;
  } catch {
    return 0;
  }
}

// Each surface asks for a different `slot`, so two promos on the same page show
// two different videos instead of the same thumbnail twice. A video someone has
// already clicked drops out of rotation: a second click on it is not a new
// view, and the slot is better spent on one they have not seen. Once every
// video has been clicked the full list comes back rather than going blank.
//
// `freshOnly` is for the interrupting surfaces: a modal that pushes a video
// someone has already watched is pure annoyance, so it gets nothing instead.
export function pickVideo(slot: number, { freshOnly = false } = {}): PromoVideo | null {
  if (PROMO_VIDEOS.length === 0) return null;
  const watched = readWatched();
  const fresh = PROMO_VIDEOS.filter((v) => !watched.includes(v.id));
  if (freshOnly && fresh.length === 0) return null;
  const pool = fresh.length > 0 ? fresh : PROMO_VIDEOS;
  return pool[(sessionSeed() + slot) % pool.length];
}

export const POPUP_EVENT = "video-popup:request";

export type PopupTrigger = "exit" | "return" | "after_roast" | "after_compat";

// Lets a page ask for the popup at its own payoff moment, after a delay — e.g.
// once a roast has landed and been read. Still subject to every guard in
// VideoPopup, so asking is never a guarantee. Returns a cancel function.
export function requestVideoPopup(source: PopupTrigger, delayMs = 0) {
  const id = window.setTimeout(
    () => window.dispatchEvent(new CustomEvent(POPUP_EVENT, { detail: source })),
    delayMs
  );
  return () => window.clearTimeout(id);
}
