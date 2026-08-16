import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getLeaderboard,
  getVisitorScope,
  type FeedScope,
  type LeaderboardEntry,
  type LeaderboardRange,
  type LeaderboardSection,
  type Leaderboards,
} from "@/lib/api";
import { track } from "@/lib/analytics";
import { asRarityId, auraRing } from "@/lib/cardAura";
import { CardAura } from "./CardAura";
import { LeaderboardPosterButton } from "./LeaderboardPoster";
import { useStudioMode } from "@/lib/studio";

const trackBoardClick = (board: "most_roasted" | "most_savage", rank: number) =>
  track("leaderboard_profile_clicked", { board, rank });

type Tab = { scope: FeedScope; label: string };

const profileHref = (entry: LeaderboardEntry) => `/${entry.username}?language=english`;

// Every avatar on the boards carries its owner's card aura, so a rare pull is
// visible even in a one-line ledger row where nothing else about the profile
// is. Nothing is rendered differently for a profile whose card is face-down.
function Avatar({
  entry,
  className,
  intensity = 0.8,
}: {
  entry: LeaderboardEntry;
  className: string;
  intensity?: number;
}) {
  const ring = auraRing(asRarityId(entry.card_tier), intensity);

  return entry.profile_pic_url ? (
    <img
      src={entry.profile_pic_url}
      alt=""
      loading="lazy"
      {...ring}
      className={`${className} ${
        ring?.className ?? ""
      } relative rounded-full border-2 border-foreground object-cover shrink-0`}
    />
  ) : (
    <span
      {...ring}
      className={`${className} ${
        ring?.className ?? ""
      } relative rounded-full border-2 border-foreground bg-muted shrink-0`}
    />
  );
}

/* --- most roasted: poster podium ---------------------------------------- */

// #1 gets a wanted-poster treatment: oversized rank as a typographic watermark,
// a stamped label, and the metric spelled out — the board's whole reason to
// exist is this one card.
function ChampionPoster({ entry }: { entry: LeaderboardEntry }) {
  const count = entry.roast_count ?? 0;
  return (
    <Link
      to={profileHref(entry)}
      onClick={() => trackBoardClick("most_roasted", 1)}
      className="relative block bg-card border-2 border-foreground rounded-3xl p-4 sm:p-6 shadow-brutal sm:rotate-[-0.6deg] hover:rotate-0 hover:-translate-y-1 transition-all overflow-hidden"
    >
      <CardAura tier={asRarityId(entry.card_tier)} intensity={1.8} />
      <span
        aria-hidden="true"
        className="absolute -right-3 -bottom-5 sm:-bottom-8 font-black text-[4rem] sm:text-[9rem] leading-none opacity-[0.06] select-none tabular-nums"
      >
        01
      </span>
      {/* In flow on mobile: the card is clipped and rounded, so an absolutely
          positioned badge loses its corner on narrow screens. */}
      <span className="relative mb-3 inline-block max-w-full bg-primary text-primary-foreground border-2 border-foreground rounded-full px-2.5 sm:px-3 py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest -rotate-1 sm:rotate-[4deg] shadow-[2px_2px_0_0_hsl(var(--brutal))] sm:absolute sm:-top-0.5 sm:right-4 sm:mb-0">
        public enemy no.1
      </span>

      <div className="relative flex items-center gap-3 sm:gap-5 sm:pt-3">
        <Avatar entry={entry} className="size-16 sm:size-20 md:size-24" intensity={1.3} />
        <div className="min-w-0 flex-1">
          <span className="block font-serif italic font-bold text-lg sm:text-xl md:text-2xl truncate">
            @{entry.username}
          </span>
          {entry.full_name && (
            <span className="block text-sm text-muted-foreground truncate">{entry.full_name}</span>
          )}
          <span className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="font-black text-2xl sm:text-3xl tabular-nums">{count}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {count === 1 ? "person" : "people"} watched the burn
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function RunnerTile({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  return (
    <Link
      to={profileHref(entry)}
      onClick={() => trackBoardClick("most_roasted", rank)}
      className="relative bg-card border-2 border-foreground rounded-2xl p-4 shadow-[3px_3px_0_0_hsl(var(--brutal))] hover:-translate-y-1 transition-all flex items-center gap-3"
    >
      <CardAura tier={asRarityId(entry.card_tier)} intensity={1.2} />
      <span className="relative font-mono font-bold text-sm text-muted-foreground tabular-nums shrink-0">
        {String(rank).padStart(2, "0")}
      </span>
      <Avatar entry={entry} className="size-11" />
      <span className="relative min-w-0 flex-1">
        <span className="block font-bold text-sm truncate">@{entry.username}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {entry.roast_count ?? 0} 👀
        </span>
      </span>
    </Link>
  );
}

function LedgerRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  return (
    <Link
      to={profileHref(entry)}
      onClick={() => trackBoardClick("most_roasted", rank)}
      className="flex items-center gap-3 py-2.5 px-1 hover:bg-background hover:px-3 rounded-xl transition-all"
    >
      <span className="font-mono text-sm text-muted-foreground tabular-nums shrink-0 w-6">
        {String(rank).padStart(2, "0")}
      </span>
      <Avatar entry={entry} className="size-8" />
      <span className="flex-1 min-w-0 font-bold text-sm truncate">@{entry.username}</span>
      <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
        {entry.roast_count ?? 0} 👀
      </span>
    </Link>
  );
}

function MostRoastedBoard({
  section,
  limit,
  onAllTime,
}: {
  section: LeaderboardSection | null;
  limit?: number;
  onAllTime?: () => void;
}) {
  const entries = (section?.entries ?? []).slice(0, limit);
  const [champion, ...rest] = entries;
  const runners = rest.slice(0, 2);
  const ledger = rest.slice(2);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="font-serif italic font-bold text-xl md:text-2xl">🔥 most roasted</h3>
        {section?.label && section.scope !== "global" && (
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            {section.label}
          </span>
        )}
      </div>

      {!champion ? (
        <EmptyBoard
          text="nobody's been cooked here yet."
          cta="light the first fire →"
          onAllTime={onAllTime}
        />
      ) : (
        <>
          <div className="animate-reveal">
            <ChampionPoster entry={champion} />
          </div>

          {runners.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {runners.map((entry, i) => (
                <div
                  key={entry.username}
                  className="animate-reveal"
                  style={{ animationDelay: `${100 + i * 80}ms` }}
                >
                  <RunnerTile entry={entry} rank={i + 2} />
                </div>
              ))}
            </div>
          )}

          {ledger.length > 0 && (
            <div className="divide-y-2 divide-dashed divide-foreground/15 border-t-2 border-dashed border-foreground/15">
              {ledger.map((entry, i) => (
                <div
                  key={entry.username}
                  className="animate-reveal"
                  style={{ animationDelay: `${260 + i * 60}ms` }}
                >
                  <LedgerRow entry={entry} rank={i + 4} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* --- most savage: inverted case file ------------------------------------ */

// Tiny read-only version of the BurnRating flame scale, so the score here
// visually rhymes with the widget people voted on.
function FlameMeter({ average }: { average: number }) {
  const filled = Math.round(average);
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5 text-[11px] leading-none">
      {[1, 2, 3, 4, 5].map((f) => (
        <span key={f} className={f <= filled ? "" : "grayscale opacity-30"}>
          🔥
        </span>
      ))}
    </span>
  );
}

function SavageRow({
  entry,
  rank,
  featured,
}: {
  entry: LeaderboardEntry;
  rank: number;
  featured?: boolean;
}) {
  const average = entry.average ?? 0;
  // The savage board is inverted (cream on ink), which is the one place an aura
  // has room to actually glow — so it gets a touch more of it.
  const ring = auraRing(asRarityId(entry.card_tier), featured ? 1.4 : 1);
  return (
    <Link
      to={profileHref(entry)}
      onClick={() => trackBoardClick("most_savage", rank)}
      className={`flex items-center gap-3 rounded-xl transition-all hover:bg-background/15 ${
        featured ? "bg-background/10 p-3" : "py-2 px-1 hover:px-3"
      }`}
    >
      <span className="font-mono text-sm tabular-nums text-background/60 shrink-0 w-6">
        {String(rank).padStart(2, "0")}
      </span>
      <span
        {...ring}
        className={`shrink-0 rounded-full border-2 border-background/40 overflow-hidden ${
          ring?.className ?? ""
        } ${featured ? "size-12" : "size-8"}`}
      >
        {entry.profile_pic_url ? (
          <img src={entry.profile_pic_url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="block size-full bg-background/20" />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block font-bold truncate ${featured ? "text-base" : "text-sm"}`}>
          @{entry.username}
        </span>
        {featured && entry.full_name && (
          <span className="block text-xs text-background/60 truncate">{entry.full_name}</span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className={`block font-black tabular-nums ${featured ? "text-2xl" : "text-sm"}`}>
          {average.toFixed(1)}
        </span>
        <FlameMeter average={average} />
        {entry.votes != null && (
          <span className="block text-[10px] font-mono text-background/50 tabular-nums">
            {entry.votes} votes
          </span>
        )}
      </span>
    </Link>
  );
}

function SavageBoard({
  section,
  limit,
  onAllTime,
}: {
  section: LeaderboardSection | null;
  limit?: number;
  onAllTime?: () => void;
}) {
  const entries = (section?.entries ?? []).slice(0, limit);

  return (
    <div
      className="bg-foreground text-background border-2 border-foreground rounded-3xl p-4 sm:p-5 md:p-6 shadow-brutal sm:rotate-[0.4deg] animate-reveal"
      style={{ animationDelay: "150ms" }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="font-serif italic font-bold text-xl md:text-2xl">💀 most savage</h3>
        {section?.label && section.scope !== "global" && (
          <span className="text-[10px] font-black uppercase tracking-wider text-background/60">
            {section.label}
          </span>
        )}
      </div>
      <p className="text-xs text-background/60 mb-4">highest burn ratings, as judged by the crowd</p>

      {entries.length === 0 ? (
        <div className="border-2 border-dashed border-background/30 rounded-2xl p-6 text-center space-y-2">
          <p className="font-serif italic">no verdicts in yet.</p>
          <p className="text-xs text-background/60">
            rate a roast and the case file opens.
          </p>
          {/* A quiet day doesn't mean an empty archive — the all-time board is
              almost never empty, so offer it rather than ending on a dead end. */}
          {onAllTime && (
            <button
              type="button"
              onClick={onAllTime}
              className="text-xs font-bold underline decoration-wavy underline-offset-4 hover:text-primary transition-colors"
            >
              see the all-time verdicts →
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-background/15">
          {entries.map((entry, i) => (
            <div key={entry.username} className={i === 0 ? "pb-2" : ""}>
              <SavageRow entry={entry} rank={i + 1} featured={i === 0} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- shared bits --------------------------------------------------------- */

function EmptyBoard({
  text,
  cta,
  onAllTime,
}: {
  text: string;
  cta: string;
  onAllTime?: () => void;
}) {
  return (
    <div className="border-2 border-dashed border-foreground/30 rounded-3xl p-8 text-center space-y-3">
      <p className="text-3xl">🦗</p>
      <p className="font-serif italic">{text}</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/"
          className="text-sm font-bold underline decoration-wavy underline-offset-4 hover:text-primary transition-colors"
        >
          {cta}
        </Link>
        {/* Only passed on the day board: nothing happened in the window, but the
            archive still has a lineup to show. */}
        {onAllTime && (
          <button
            type="button"
            onClick={onAllTime}
            className="text-sm font-bold underline decoration-wavy underline-offset-4 hover:text-primary transition-colors"
          >
            see the all-time board →
          </button>
        )}
      </div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
      <div className="lg:col-span-7 space-y-3">
        <div className="h-36 bg-card border-2 border-foreground rounded-3xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-card border-2 border-foreground rounded-2xl animate-pulse" />
          <div className="h-20 bg-card border-2 border-foreground rounded-2xl animate-pulse" />
        </div>
        <div className="h-32 bg-card border-2 border-foreground rounded-2xl animate-pulse" />
      </div>
      <div className="lg:col-span-5">
        <div className="h-full min-h-64 bg-foreground/80 border-2 border-foreground rounded-3xl animate-pulse" />
      </div>
    </div>
  );
}

const RANGE_TABS: { range: LeaderboardRange; label: string }[] = [
  { range: "day", label: "today" },
  { range: "all", label: "all time" },
];

const RANGE_COPY: Record<LeaderboardRange, { heading: string; highlight: string; meta: string }> = {
  day: { heading: "today's", highlight: "biggest losses", meta: "live · rolling 24h window" },
  all: { heading: "all-time", highlight: "biggest losses", meta: "since day one · every burn ever" },
};

export function Leaderboard({ standalone = false }: { standalone?: boolean }) {
  const [tabs, setTabs] = useState<Tab[]>([{ scope: "global", label: "🌍 global" }]);
  const [active, setActive] = useState<FeedScope>("global");
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [loading, setLoading] = useState(true);
  const studio = useStudioMode();

  // On the dedicated page the range lives in the URL, so an all-time board can
  // be linked and shared as one — that board is the evergreen half and the only
  // one still true tomorrow. The homepage embed keeps it in local state; it has
  // no URL of its own to write to.
  const [params, setParams] = useSearchParams();
  const [localRange, setLocalRange] = useState<LeaderboardRange>("day");
  const range: LeaderboardRange =
    standalone ? (params.get("range") === "all" ? "all" : "day") : localRange;

  const changeRange = (next: LeaderboardRange) => {
    track("leaderboard_range_changed", { range: next, standalone });
    if (!standalone) return setLocalRange(next);
    const updated = new URLSearchParams(params);
    if (next === "day") updated.delete("range");
    else updated.set("range", next);
    // Replace, not push: flicking between the two boards shouldn't fill the
    // back button with the same page.
    setParams(updated, { replace: true });
  };

  // Tabs depend on how precisely we could place this visitor — someone we
  // couldn't locate just gets the global board rather than a "near you" tab
  // that silently shows the same thing.
  useEffect(() => {
    let cancelled = false;
    getVisitorScope()
      .then(({ country, city }) => {
        if (cancelled) return;
        const next: Tab[] = [{ scope: "global", label: "🌍 global" }];
        if (country) next.push({ scope: "country", label: `📍 ${country}` });
        if (city) next.push({ scope: "city", label: `🏠 ${city}` });
        setTabs(next);
        // Open on the most local tab: it's the one people haven't seen before.
        if (city) setActive("city");
        else if (country) setActive("country");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLeaderboard(active, range)
      .then((data) => {
        if (!cancelled) setBoards(data);
      })
      .catch(() => {
        if (!cancelled) setBoards(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, range]);

  // Section-impression once per mount — page_view alone can't tell whether the
  // homepage embed was ever the thing people actually engaged with.
  useEffect(() => {
    track("leaderboard_viewed", { standalone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasAnything =
    boards && (boards.mostRoasted.entries.length > 0 || boards.topRated.entries.length > 0);

  // Before there's any traffic there's no board worth showing, and a page of
  // empty podiums makes the site look dead. The dedicated /leaderboard page
  // can't just vanish though — it renders an honest empty state instead.
  if (!loading && !hasAnything && !standalone) return null;

  return (
    <section
      id="leaderboard"
      className="py-20 px-4 sm:px-6 border-t-2 border-foreground bg-background relative overflow-hidden"
    >
      <div className="pointer-events-none absolute top-10 -left-20 size-60 rounded-full bg-yellow-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -right-20 size-60 rounded-full bg-primary/10 blur-3xl" />

      <div className="w-full max-w-5xl mx-auto relative">
        {/* Left-aligned header with the controls on the right — the boards below
            are asymmetric, so a centered header would fight the composition. */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] mb-4">
              🏆 hall of shame
            </span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold italic text-balance">
              {RANGE_COPY[range].heading}{" "}
              <span className="inline-block bg-yellow-200 dark:bg-yellow-900/40 px-2 -rotate-1 border-2 border-foreground rounded-xl">
                {RANGE_COPY[range].highlight}
              </span>
            </h2>
            {/* The switch and the line describing what it switched to are one
                unit, so they share a wrapping flex row — as two inline-level
                siblings they landed on the same line box and collided. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
              {/* Segmented, not two loose pills: the two ranges are one choice,
                  and sharing a border is what says so. */}
              <div
                role="group"
                aria-label="Leaderboard time range"
                className="flex shrink-0 border-2 border-foreground rounded-full bg-card p-1 shadow-[3px_3px_0_0_hsl(var(--brutal))]"
              >
                {RANGE_TABS.map((tab) => (
                  <button
                    key={tab.range}
                    type="button"
                    aria-pressed={range === tab.range}
                    onClick={() => changeRange(tab.range)}
                    className={`inline-flex items-center justify-center min-h-9 rounded-full px-4 py-1 text-xs font-black uppercase tracking-wider transition-all ${
                      range === tab.range
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {/* On the day board the dot is a live semantic indicator, not
                    decoration: it really is a rolling 24h window that updates as
                    views land. The archive doesn't move, so it doesn't pulse. */}
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    range === "day" ? "bg-primary animate-pulse" : "bg-muted-foreground/50"
                  }`}
                />
                {RANGE_COPY[range].meta}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {tabs.length > 1 &&
              tabs.map((tab) => (
                <button
                  key={tab.scope}
                  type="button"
                  onClick={() => {
                    track("leaderboard_tab_changed", { scope: tab.scope });
                    setActive(tab.scope);
                  }}
                  className={`inline-flex items-center justify-center min-h-11 border-2 border-foreground rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all hover:-translate-y-0.5 ${
                    active === tab.scope
                      ? "bg-primary text-primary-foreground shadow-[3px_3px_0_0_hsl(var(--brutal))]"
                      : "bg-card"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            {studio && !loading && (
              <>
                <LeaderboardPosterButton
                  board="roasted"
                  range={range}
                  section={boards?.mostRoasted ?? null}
                />
                <LeaderboardPosterButton
                  board="savage"
                  range={range}
                  section={boards?.topRated ?? null}
                />
              </>
            )}
          </div>
        </div>

        {loading ? (
          <BoardSkeleton />
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <div className="min-w-0 lg:col-span-7">
              <MostRoastedBoard
                section={boards?.mostRoasted ?? null}
                limit={standalone ? undefined : 5}
                onAllTime={range === "day" ? () => changeRange("all") : undefined}
              />
            </div>
            <div className="min-w-0 lg:col-span-5">
              <SavageBoard
                section={boards?.topRated ?? null}
                limit={standalone ? undefined : 5}
                onAllTime={range === "day" ? () => changeRange("all") : undefined}
              />
            </div>
          </div>
        )}

        {!standalone && (
          <div className="text-center mt-10">
            <Link
              to={range === "all" ? "/leaderboard?range=all" : "/leaderboard"}
              onClick={() => track("leaderboard_open_full", { range })}
              className="inline-flex items-center justify-center gap-2 min-h-11 bg-card border-2 border-foreground rounded-full px-5 py-2.5 text-sm font-black hover:-translate-y-0.5 hover:rotate-[-1deg] transition-all shadow-[3px_3px_0_0_hsl(var(--brutal))]"
            >
              open the full hall of shame 🏆
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
