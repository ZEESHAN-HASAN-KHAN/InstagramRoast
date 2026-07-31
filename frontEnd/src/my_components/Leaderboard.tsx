import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getLeaderboard,
  getVisitorScope,
  type FeedScope,
  type LeaderboardEntry,
  type LeaderboardSection,
  type Leaderboards,
} from "@/lib/api";

const MEDALS = ["🥇", "🥈", "🥉"];

type Tab = { scope: FeedScope; label: string };

function BoardRow({ entry, rank, metric }: { entry: LeaderboardEntry; rank: number; metric: string }) {
  return (
    <Link
      to={`/${entry.username}?language=english`}
      className="flex items-center gap-3 p-2 rounded-2xl border-2 border-transparent hover:border-foreground hover:bg-background hover:-translate-y-0.5 transition-all"
    >
      <span className="w-7 shrink-0 text-center font-black text-sm">
        {MEDALS[rank] ?? rank + 1}
      </span>
      {entry.profile_pic_url ? (
        <img
          src={entry.profile_pic_url}
          alt=""
          loading="lazy"
          className="size-9 rounded-full border-2 border-foreground object-cover shrink-0"
        />
      ) : (
        <span className="size-9 rounded-full border-2 border-foreground bg-muted shrink-0" />
      )}
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm truncate">@{entry.username}</span>
        {entry.full_name && (
          <span className="block text-xs text-muted-foreground truncate">{entry.full_name}</span>
        )}
      </span>
      <span className="shrink-0 text-sm font-black tabular-nums">{metric}</span>
    </Link>
  );
}

function Board({
  title,
  emptyText,
  section,
  metricFor,
}: {
  title: string;
  emptyText: string;
  section: LeaderboardSection | null;
  metricFor: (entry: LeaderboardEntry) => string;
}) {
  return (
    <div className="bg-card border-2 border-foreground rounded-3xl p-4 md:p-6 shadow-brutal">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="font-serif italic text-lg md:text-xl">{title}</h3>
        {/* The backend widens the scope when a local board is too thin, so label
            what actually came back rather than what the tab asked for. */}
        {section?.label && section.scope !== "global" && (
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">
            {section.label}
          </span>
        )}
      </div>

      {!section || section.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-6 text-center">{emptyText}</p>
      ) : (
        <div className="space-y-1">
          {section.entries.map((entry, i) => (
            <BoardRow key={entry.username} entry={entry} rank={i} metric={metricFor(entry)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Leaderboard() {
  const [tabs, setTabs] = useState<Tab[]>([{ scope: "global", label: "🌍 global" }]);
  const [active, setActive] = useState<FeedScope>("global");
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [loading, setLoading] = useState(true);

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
    getLeaderboard(active)
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
  }, [active]);

  const hasAnything =
    boards && (boards.mostRoasted.entries.length > 0 || boards.topRated.entries.length > 0);

  // Before there's any traffic there's no board worth showing, and a page of
  // empty podiums makes the site look dead.
  if (!loading && !hasAnything) return null;

  return (
    <section className="py-20 px-6 border-t-2 border-foreground bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute top-10 -left-20 size-60 rounded-full bg-yellow-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -right-20 size-60 rounded-full bg-primary/10 blur-3xl" />

      <div className="max-w-4xl mx-auto relative">
        <div className="text-center mb-8">
          <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] mb-4">
            🏆 hall of shame
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold italic text-balance">
            today's{" "}
            <span className="inline-block bg-yellow-200 dark:bg-yellow-900/40 px-2 -rotate-1 border-2 border-foreground rounded-xl">
              biggest losses
            </span>
          </h2>
          <p className="mt-4 text-foreground/70">who got cooked hardest in the last 24 hours. 🍳</p>
        </div>

        {tabs.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.scope}
                type="button"
                onClick={() => setActive(tab.scope)}
                className={`border-2 border-foreground rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all hover:-translate-y-0.5 ${
                  active === tab.scope
                    ? "bg-primary text-primary-foreground shadow-[3px_3px_0_0_hsl(0_0%_8%)]"
                    : "bg-card"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Board
            title="🔥 most roasted"
            emptyText="nobody's been cooked here yet — go first."
            section={boards?.mostRoasted ?? null}
            // Distinct people, not page loads — "12×" would read as "roasted 12
            // times", which isn't what the number counts.
            metricFor={(entry) => `${entry.roast_count ?? 0} 👀`}
          />
          <Board
            title="💀 most savage"
            emptyText="no verdicts in yet — go rate some roasts."
            section={boards?.topRated ?? null}
            metricFor={(entry) => `${(entry.average ?? 0).toFixed(1)}🔥`}
          />
        </div>
      </div>
    </section>
  );
}
