import { useEffect, useState } from "react";
import { getRatingStats, rateProfile, type RatingStats } from "@/lib/api";
import NumberTicker from "@/components/ui/number-ticker";

const FLAMES = [1, 2, 3, 4, 5];

const VERDICTS: Record<number, string> = {
  1: "barely a sunburn 🧴",
  2: "mildly toasted 🍞",
  3: "properly cooked 🍳",
  4: "third-degree burns 🚑",
  5: "call a priest ⚰️",
};

export function BurnRating({ username }: { username: string }) {
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
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

  async function vote(rating: number) {
    if (saving) return;
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

  const yourRating = stats?.yourRating ?? null;
  // Hovering previews that rating; otherwise show what they already picked.
  const shown = hovered ?? yourRating ?? 0;
  const hasVoted = yourRating !== null;
  const percentile = stats?.local ?? stats?.global ?? null;
  const percentileLabel = stats?.local ? stats.localLabel : "the world";

  return (
    <div className="bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[0.4deg] text-center space-y-4">
      <h3 className="font-serif italic text-xl md:text-2xl">
        how burnt {hasVoted ? "did they get" : "are they"}? 🔥
      </h3>

      <div className="flex items-center justify-center gap-1 sm:gap-2" onMouseLeave={() => setHovered(null)}>
        {FLAMES.map((flame) => (
          <button
            key={flame}
            type="button"
            disabled={saving}
            onMouseEnter={() => setHovered(flame)}
            onFocus={() => setHovered(flame)}
            onBlur={() => setHovered(null)}
            onClick={() => vote(flame)}
            aria-label={`Rate ${flame} out of 5`}
            aria-pressed={yourRating === flame}
            className={`text-3xl sm:text-4xl transition-all duration-150 disabled:cursor-wait hover:scale-125 hover:-rotate-12 ${
              flame <= shown ? "grayscale-0 scale-110" : "grayscale opacity-40"
            }`}
          >
            🔥
          </button>
        ))}
      </div>

      <p className="text-sm font-bold h-5">
        {shown ? VERDICTS[shown] : "tap a flame to judge the damage"}
      </p>

      {stats && stats.count > 0 && (
        <div className="pt-4 border-t-2 border-dashed border-foreground/30 space-y-3">
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

          {percentile && (
            <p className="inline-flex items-center gap-2 bg-yellow-200 dark:bg-yellow-900/40 border-2 border-foreground rounded-full px-4 py-1.5 text-xs font-black rotate-[-1deg] shadow-[3px_3px_0_0_hsl(0_0%_8%)]">
              💀 top {percentile.topPercent}% most savage in {percentileLabel}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive font-bold">{error}</p>}
    </div>
  );
}
