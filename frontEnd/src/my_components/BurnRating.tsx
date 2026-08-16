import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getRatingStats, rateProfile, type RatingStats } from "@/lib/api";
import NumberTicker from "@/components/ui/number-ticker";
import { track } from "@/lib/analytics";

const FLAMES = [1, 2, 3, 4, 5];

const VERDICTS: Record<number, string> = {
  1: "barely a sunburn 🧴",
  2: "mildly toasted 🍞",
  3: "properly cooked 🍳",
  4: "third-degree burns 🚑",
  5: "call a priest ⚰️",
};

// Both prompts are remembered for the session so neither becomes the thing
// people learn to close on every roast.
const nudgeKey = (username: string) => `burn-nudge-dismissed:${username}`;
const modalKey = (username: string) => `burn-modal-shown:${username}`;

// How long after the panel scrolls out of view before the modal opens. Long
// enough that a fast flick down the page doesn't trigger it mid-scroll, short
// enough to still be attached to having just read the roast.
const MODAL_DELAY_MS = 1100;

export function BurnRating({ username }: { username: string }) {
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the panel has been scrolled past — the cue for both asks.
  const [scrolledPast, setScrolledPast] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  // The popup is the loud ask and fires at most once per profile per session;
  // closing it without voting hands off to the quiet dock instead of asking
  // again. Escalate once, then get out of the way.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSpent, setModalSpent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // The impression fires from inside the observer above, which is set up once —
  // these carry the current values in without re-arming it.
  const seenFired = useRef(false);
  const statsRef = useRef<RatingStats | null>(null);
  statsRef.current = stats;

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setNudgeDismissed(sessionStorage.getItem(nudgeKey(username)) === "1");
    setModalSpent(sessionStorage.getItem(modalKey(username)) === "1");
    setModalOpen(false);
    seenFired.current = false;
    getRatingStats(username)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // A missing rating panel shouldn't look like a broken page — the roast
        // above it is the point. Leaving stats null just keeps it in its
        // pre-vote state.
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  // Watches the panel itself rather than a scroll offset, so the nudge appears
  // exactly when the real ask leaves the screen and hides again when it's back.
  // The same observation doubles as the impression: without a "this was on
  // screen" event there's no denominator, and a vote count alone can't tell a
  // good conversion rate from a bad one.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !seenFired.current) {
          seenFired.current = true;
          const snapshot = statsRef.current;
          track("burn_rating_shown", {
            judges: snapshot?.count ?? 0,
            // Someone revisiting a roast they already rated can't convert, and
            // counting them in the denominator would flatten the rate.
            has_voted: snapshot?.yourRating != null,
          });
        }
        // Only counts as "past" when the panel has left upward. Below the fold
        // it hasn't been seen yet, and nudging for something not yet reached is
        // just noise.
        setScrolledPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // Re-armed per profile: the component stays mounted across a navigation
    // from one roast to another, and observing again re-fires immediately for
    // an element already on screen.
  }, [username]);

  async function vote(rating: number, source: "panel" | "nudge" | "modal") {
    if (saving) return;
    // `source` is the whole point of this event now — three surfaces ask for
    // the same vote, and only this tells you which one earns its keep.
    track("burn_rating_voted", {
      rating,
      revote: hasVoted,
      source,
      judges: stats?.count ?? 0,
    });
    setSaving(true);
    setError(null);
    // Optimistic: the flames fill instantly, then the real averages land.
    setStats((prev) => (prev ? { ...prev, yourRating: rating } : prev));
    try {
      setStats(await rateProfile(username, rating));
    } catch {
      setError("couldn't save that — try again");
    } finally {
      setSaving(false);
    }
  }

  function closeModal(reason: "skip" | "voted") {
    setModalOpen(false);
    setModalSpent(true);
    sessionStorage.setItem(modalKey(username), "1");
    if (reason === "skip") track("burn_rating_modal_skipped");
  }

  function dismissNudge() {
    track("burn_rating_nudge_dismissed");
    setNudgeDismissed(true);
    sessionStorage.setItem(nudgeKey(username), "1");
  }

  const yourRating = stats?.yourRating ?? null;
  // Hovering previews that rating; otherwise show what they already picked.
  const shown = hovered ?? yourRating ?? 0;
  const hasVoted = yourRating !== null;
  const percentile = stats?.local ?? stats?.global ?? null;
  const percentileLabel = stats?.local ? stats.localLabel : "the world";
  const judges = stats?.count ?? 0;
  const eligible = scrolledPast && !hasVoted && stats !== null;
  // The dock only takes over once the popup has had its turn — two asks on
  // screen at once is how a prompt becomes an ad.
  const showNudge = eligible && modalSpent && !nudgeDismissed;

  // Opens the popup a beat after the roast leaves the screen, which is as close
  // as the page can get to "they finished reading".
  useEffect(() => {
    if (!eligible || modalSpent) return;
    const timer = window.setTimeout(() => {
      setModalOpen(true);
      track("burn_rating_modal_shown", { judges });
    }, MODAL_DELAY_MS);
    // Scrolling back up to the panel cancels it — they're looking at the real
    // thing, so throwing a copy of it over the top would be absurd.
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, modalSpent]);

  // Esc closes, and the page behind stops scrolling while it's open.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal("skip");
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  useEffect(() => {
    if (showNudge) track("burn_rating_nudge_shown", { judges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNudge]);

  return (
    <>
      <div
        ref={panelRef}
        className="bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[0.4deg] text-center space-y-4"
      >
        <div className="space-y-1">
          <h3 className="font-serif italic text-xl md:text-2xl">
            how burnt {hasVoted ? "did they get" : "are they"}? 🔥
          </h3>
          {/* Social proof before the ask, not after it: "12 people already did
              this" is the single strongest reason someone joins in. */}
          {!hasVoted && (
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              {judges > 0
                ? `${judges} ${judges === 1 ? "person has" : "people have"} judged this · you're next`
                : "nobody's judged this one yet · go first"}
            </p>
          )}
        </div>

        <div
          className={`flex items-center justify-center gap-1 sm:gap-2 ${
            hasVoted ? "" : "rating-invite"
          }`}
          onMouseLeave={() => setHovered(null)}
        >
          {FLAMES.map((flame) => (
            <button
              key={flame}
              type="button"
              disabled={saving}
              onMouseEnter={() => setHovered(flame)}
              onFocus={() => setHovered(flame)}
              onBlur={() => setHovered(null)}
              onClick={() => vote(flame, "panel")}
              aria-label={`Rate ${flame} out of 5`}
              aria-pressed={yourRating === flame}
              style={{ animationDelay: `${flame * 90}ms` }}
              className={`text-3xl sm:text-4xl transition-all duration-150 disabled:cursor-wait hover:scale-125 hover:-rotate-12 ${
                flame <= shown ? "grayscale-0 scale-110" : "grayscale opacity-40"
              }`}
            >
              🔥
            </button>
          ))}
        </div>

        <p className="text-sm font-bold h-5">
          {shown ? VERDICTS[shown] : "one tap. you're the judge."}
        </p>

        {/* The crowd's verdict is the payoff for casting one. Showing it to
            everyone regardless left no reason to participate, which is most of
            why this sat untouched. */}
        {hasVoted && stats && stats.count > 0 && (
          <div className="pt-4 border-t-2 border-dashed border-foreground/30 space-y-3 animate-reveal">
            <p className="text-sm text-muted-foreground">
              <span className="font-black text-foreground text-base">
                {stats.average?.toFixed(1)}
              </span>{" "}
              🔥 average from{" "}
              <span className="font-bold text-foreground">
                <NumberTicker value={stats.count} />
              </span>{" "}
              {stats.count === 1 ? "judge" : "judges"}
            </p>

            {percentile ? (
              // The percentile is the hook — clicking it lands on the board it
              // ranks on, which is the leaderboard's main discovery path.
              <Link
                to="/leaderboard"
                onClick={() =>
                  track("rank_badge_clicked", { has_percentile: true, source: "panel" })
                }
                className="inline-flex items-center gap-2 bg-yellow-200 dark:bg-yellow-900/40 border-2 border-foreground rounded-full px-4 py-1.5 text-xs font-black rotate-[-1deg] shadow-[3px_3px_0_0_hsl(var(--brutal))] hover:-translate-y-0.5 hover:rotate-0 transition-all"
              >
                💀 top {percentile.topPercent}% most savage in {percentileLabel} → see the board
              </Link>
            ) : (
              <Link
                to="/leaderboard"
                onClick={() =>
                  track("rank_badge_clicked", { has_percentile: false, source: "panel" })
                }
                className="inline-block text-xs font-bold underline decoration-wavy underline-offset-4 hover:text-primary transition-colors"
              >
                where do they rank? see the hall of shame →
              </Link>
            )}
          </div>
        )}

        {/* Pre-vote: name the payoff and hide the number itself. An honest
            trade — their verdict for the crowd's. */}
        {!hasVoted && judges > 0 && (
          <div className="pt-4 border-t-2 border-dashed border-foreground/30">
            <p className="text-sm text-muted-foreground">
              <span
                aria-hidden="true"
                className="font-black text-foreground text-base blur-[5px] select-none"
              >
                {stats?.average?.toFixed(1)}
              </span>{" "}
              🔥 crowd score — <span className="font-bold text-foreground">rate to unlock it</span>
            </p>
          </div>
        )}

        {error && <p className="text-xs text-destructive font-bold">{error}</p>}
      </div>

      {/* The popup. Fires once, a beat after the roast scrolls off — the moment
          someone has an opinion and nothing left on screen to do with it.
          Voting inside it pays out immediately rather than closing, because the
          crowd score is what was being offered in exchange. */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Rate the roast of @${username}`}
        >
          {/* A fixed dark scrim, not a themed one: `foreground` is near-white in
              dark mode, so tying the backdrop to it washed the page lighter
              instead of dimming it. A dialog needs the page to recede in both
              themes, and that only ever means dark. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => closeModal("skip")}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-reveal"
          />

          <div className="relative w-full max-w-md bg-card border-2 border-foreground rounded-3xl p-6 shadow-brutal text-center space-y-4 animate-pop">
            <button
              type="button"
              onClick={() => closeModal("skip")}
              aria-label="Dismiss"
              className="absolute top-3 right-4 text-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>

            {hasVoted ? (
              <>
                <p className="text-4xl">{shown >= 4 ? "💀" : "🔥"}</p>
                <h3 className="font-serif italic text-2xl">{VERDICTS[shown]}</h3>
                <p className="text-sm text-muted-foreground">
                  the crowd says{" "}
                  <span className="font-black text-foreground text-base">
                    {stats?.average?.toFixed(1)}
                  </span>{" "}
                  🔥 from{" "}
                  <span className="font-bold text-foreground">{stats?.count}</span>{" "}
                  {stats?.count === 1 ? "judge" : "judges"}
                </p>
                {percentile && (
                  <Link
                    to="/leaderboard"
                    onClick={() => track("rank_badge_clicked", { has_percentile: true, source: "modal" })}
                    className="inline-flex items-center gap-2 bg-yellow-200 dark:bg-yellow-900/40 border-2 border-foreground rounded-full px-4 py-1.5 text-xs font-black rotate-[-1deg] shadow-[3px_3px_0_0_hsl(var(--brutal))] hover:-translate-y-0.5 hover:rotate-0 transition-all"
                  >
                    💀 top {percentile.topPercent}% most savage in {percentileLabel} → see the board
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => closeModal("voted")}
                  className="block w-full min-h-11 bg-foreground text-background border-2 border-foreground rounded-full px-5 text-sm font-black hover:-translate-y-0.5 transition-all"
                >
                  back to the roast
                </button>
              </>
            ) : (
              <>
                <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest rotate-[-2deg]">
                  ⚖️ your verdict
                </span>
                <h3 className="font-serif italic text-2xl">how burnt is @{username}?</h3>
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  {judges > 0
                    ? `${judges} ${judges === 1 ? "person has" : "people have"} judged · unlock the score`
                    : "nobody's judged this one yet · go first"}
                </p>

                <div
                  className="rating-invite flex items-center justify-center gap-1.5"
                  onMouseLeave={() => setHovered(null)}
                >
                  {FLAMES.map((flame) => (
                    <button
                      key={flame}
                      type="button"
                      disabled={saving}
                      autoFocus={flame === 1}
                      onMouseEnter={() => setHovered(flame)}
                      onFocus={() => setHovered(flame)}
                      onBlur={() => setHovered(null)}
                      onClick={() => vote(flame, "modal")}
                      aria-label={`Rate ${flame} out of 5`}
                      style={{ animationDelay: `${flame * 90}ms` }}
                      className={`text-4xl transition-all duration-150 disabled:cursor-wait hover:scale-125 hover:-rotate-12 ${
                        flame <= shown ? "grayscale-0 scale-110" : "grayscale opacity-40"
                      }`}
                    >
                      🔥
                    </button>
                  ))}
                </div>

                <p className="text-sm font-bold h-5">{shown ? VERDICTS[shown] : "one tap. that's it."}</p>

                <button
                  type="button"
                  onClick={() => closeModal("skip")}
                  className="text-xs font-bold text-muted-foreground underline decoration-wavy underline-offset-4 hover:text-foreground transition-colors"
                >
                  nah, skip it
                </button>
              </>
            )}

            {error && <p className="text-xs text-destructive font-bold">{error}</p>}
          </div>
        </div>
      )}

      {/* Floating ask, once the panel has scrolled by unanswered. Most people
          never come back up a page, so the ask has to follow them down. */}
      {showNudge && (
        <div className="fixed inset-x-3 bottom-3 z-40 animate-reveal sm:inset-x-auto sm:right-4 sm:max-w-sm">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-foreground bg-card px-3 py-2.5 shadow-brutal">
            <span className="min-w-0 flex-1 text-xs font-bold leading-tight">
              rate @{username}'s roast
              <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                one tap · unlocks the crowd score
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-0.5">
              {FLAMES.map((flame) => (
                <button
                  key={flame}
                  type="button"
                  disabled={saving}
                  onClick={() => vote(flame, "nudge")}
                  aria-label={`Rate ${flame} out of 5`}
                  className="text-lg transition-transform hover:scale-125 disabled:cursor-wait"
                >
                  🔥
                </button>
              ))}
            </span>
            <button
              type="button"
              onClick={dismissNudge}
              aria-label="Dismiss rating prompt"
              className="shrink-0 rounded-full px-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
