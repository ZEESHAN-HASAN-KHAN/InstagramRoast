import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";
import { cleanHandle } from "@/lib/utils";
import { track } from "@/lib/analytics";

type CompatUpsellProps = {
  username: string;
  language: string;
};

const CHIP_COUNT = 3;

// The roast page ends in a one-person share. This card reuses the handle we
// already roasted as the first half of a compatibility run, so the visitor only
// has to supply one more name — or tap someone off the leaderboard.
export function CompatUpsell({ username, language }: CompatUpsellProps) {
  const navigate = useNavigate();
  const [partner, setPartner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [chips, setChips] = useState<LeaderboardEntry[]>([]);

  // Denominator for the upsell CTR. Fires once per delivered roast — the roast
  // page only mounts this component after the result lands.
  useEffect(() => {
    track("compat_upsell_shown");
  }, []);

  // Chips are a bonus, never a blocker: any failure just leaves the card as a
  // plain input.
  useEffect(() => {
    let cancelled = false;
    getLeaderboard("global")
      .then((boards) => {
        if (cancelled) return;
        const picks = boards.mostRoasted.entries
          .filter((e) => e.username.toLowerCase() !== username.toLowerCase())
          .slice(0, CHIP_COUNT);
        setChips(picks);
      })
      .catch(() => {
        /* no chips, no problem */
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  function cook(handle: string, source: "chip" | "typed") {
    const cleaned = cleanHandle(handle);
    if (!cleaned) return;
    if (cleaned.toLowerCase() === username.toLowerCase()) {
      setError("you can't date yourself 💀 pick someone else");
      return;
    }
    track("compat_upsell_clicked", { source, language });
    navigate(
      `/compatibilityRoast?uname1=${encodeURIComponent(username)}&uname2=${encodeURIComponent(
        cleaned
      )}&language=${language}`
    );
  }

  return (
    <section className="relative bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[-0.4deg] overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-pink-300/20 blur-3xl" />

      <div className="relative space-y-5">
        <div className="text-center space-y-2">
          <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest rotate-[-2deg]">
            ❤️‍🔥 double or nothing
          </span>
          <h2 className="text-2xl md:text-3xl font-serif font-bold italic text-balance">
            now cook{" "}
            <span className="text-primary underline decoration-wavy decoration-accent underline-offset-4">
              @{username}
            </span>{" "}
            × someone 💀
          </h2>
          <p className="text-sm text-muted-foreground">
            one more handle. the AI decides if they'd survive each other.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            cook(partner, "typed");
          }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          {/* First slot is locked in — showing it as a pill rather than an input
              is the whole pitch: they're already halfway there. */}
          <span className="w-full sm:w-auto sm:max-w-[40%] shrink-0 truncate text-center px-4 py-3 bg-muted border-2 border-foreground rounded-2xl font-mono font-bold">
            @{username}
          </span>
          <span className="shrink-0 size-9 bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground rounded-full flex items-center justify-center font-black text-xs shadow-[3px_3px_0_0_hsl(var(--brutal))]">
            ×
          </span>
          <input
            type="text"
            value={partner}
            onChange={(e) => {
              setPartner(e.target.value);
              if (error) setError(null);
            }}
            placeholder="@their_handle"
            aria-label="Second Instagram handle"
            className="flex-1 w-full min-w-0 px-4 py-3 bg-background border-2 border-foreground rounded-2xl font-mono outline-none focus:shadow-[3px_3px_0_0_hsl(var(--primary))] transition-all text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="w-full sm:w-auto shrink-0 bg-primary text-primary-foreground px-5 py-3 rounded-2xl font-black uppercase tracking-wider hover:-translate-y-0.5 hover:rotate-1 transition-all cursor-pointer border-2 border-foreground shadow-[3px_3px_0_0_hsl(var(--brutal))]"
          >
            cook 'em 🔥
          </button>
        </form>

        {error && <p className="text-center text-xs font-bold text-primary">{error}</p>}

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground italic">or pick a victim →</span>
            {chips.map((entry, i) => (
              <button
                key={entry.username}
                type="button"
                onClick={() => cook(entry.username, "chip")}
                className={`${
                  i % 2 ? "-rotate-2" : "rotate-2"
                } inline-flex items-center gap-2 bg-background border-2 border-foreground rounded-full pl-1 pr-3 py-1 text-sm font-bold hover:-translate-y-1 hover:rotate-0 transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))] max-w-[12rem]`}
              >
                {entry.profile_pic_url ? (
                  <img
                    src={entry.profile_pic_url}
                    alt=""
                    loading="lazy"
                    className="size-7 rounded-full border-2 border-foreground object-cover shrink-0"
                  />
                ) : (
                  <span className="size-7 rounded-full border-2 border-foreground bg-muted shrink-0" />
                )}
                <span className="truncate">@{entry.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
