import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getRecentFeed,
  getVisitorScope,
  type FeedScope,
  type RoastedProfile,
} from "@/lib/api";
import { asRarityId, auraRing } from "@/lib/cardAura";
import { CardAura } from "./CardAura";

const GRID_LIMIT = 24;

type Tab = { scope: FeedScope; label: string };

function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function RoastCardLink({ roast }: { roast: RoastedProfile }) {
  const tier = asRarityId(roast.card_tier);
  // The lit panel carries the tier across the grid; the ring is what you read
  // once you're looking at one tile.
  const ring = auraRing(tier, 0.8);

  return (
    <Link
      to={`/${roast.username}?language=english`}
      className="group relative bg-card border-2 border-foreground rounded-2xl p-4 shadow-[3px_3px_0_0_hsl(var(--brutal))] hover:-translate-y-1 hover:rotate-1 transition-all flex flex-col items-center text-center gap-2"
    >
      <CardAura tier={tier} intensity={1.3} />

      {roast.profile_pic_url ? (
        <img
          src={roast.profile_pic_url}
          alt=""
          loading="lazy"
          {...ring}
          className={`relative size-16 rounded-full border-2 border-foreground object-cover ${
            ring?.className ?? ""
          }`}
        />
      ) : (
        <span
          {...ring}
          className={`relative size-16 rounded-full border-2 border-foreground bg-muted ${
            ring?.className ?? ""
          }`}
        />
      )}
      {/* Positioned, so the text stays above the flames rather than being
          tinted by them — the panel is an absolutely positioned sibling and
          would otherwise paint over everything static. */}
      <span className="relative font-bold text-sm truncate max-w-full">@{roast.username}</span>
      {roast.full_name && (
        <span className="relative text-xs text-muted-foreground truncate max-w-full">
          {roast.full_name}
        </span>
      )}
      <span className="relative text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        {timeAgo(roast.created_at)}
      </span>
      <span className="relative text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
        see the damage 🔥
      </span>
    </Link>
  );
}

export function NearbyRoasts() {
  const [tabs, setTabs] = useState<Tab[]>([{ scope: "global", label: "🌎 everywhere" }]);
  const [active, setActive] = useState<FeedScope>("global");
  const [roasts, setRoasts] = useState<RoastedProfile[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Only offer a tab for a place we could actually put this visitor — a "your
  // city" tab that can only ever be empty is worse than no tab.
  useEffect(() => {
    let cancelled = false;
    getVisitorScope()
      .then(({ country, region, city }) => {
        if (cancelled) return;
        const next: Tab[] = [];
        if (city) next.push({ scope: "city", label: `🏠 ${city}` });
        if (region) next.push({ scope: "region", label: `📍 ${region}` });
        if (country) next.push({ scope: "country", label: `🗺️ ${country}` });
        next.push({ scope: "global", label: "🌎 everywhere" });

        setTabs(next);
        setActive(next[0].scope); // most local tab first — it's the novel one
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // strict: this tab was chosen deliberately, so an empty area says so rather
    // than quietly showing the whole world under a local label.
    getRecentFeed(active, { strict: true, limit: GRID_LIMIT })
      .then((data) => {
        if (!cancelled) setRoasts(data.roasts);
      })
      .catch(() => {
        if (!cancelled) setRoasts(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const activeTab = tabs.find((tab) => tab.scope === active);
  const areaName = active === "global" ? "the world" : activeTab?.label.replace(/^\S+\s/, "");

  // Nothing anywhere means the site has no roasts at all — don't render an empty
  // browse section on a brand-new deployment.
  if (!loading && active === "global" && (!roasts || roasts.length === 0)) return null;

  return (
    <section id="recent-roasts" className="py-20 px-6 border-t-2 border-foreground bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute top-10 -right-20 size-60 rounded-full bg-sky-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-20 size-60 rounded-full bg-accent/10 blur-3xl" />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-8">
          <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] mb-4">
            👀 nosy mode
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold italic text-balance">
            roasted{" "}
            <span className="inline-block bg-sky-200 dark:bg-sky-900/40 px-2 -rotate-1 border-2 border-foreground rounded-xl">
              near you
            </span>
          </h2>
          <p className="mt-4 text-foreground/70">
            see who else has been cooked. no judgement. okay, some judgement. 🍿
          </p>
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
                    ? "bg-primary text-primary-foreground shadow-[3px_3px_0_0_hsl(var(--brutal))]"
                    : "bg-card"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border-2 border-foreground rounded-2xl p-4 h-40 animate-pulse"
              />
            ))}
          </div>
        ) : !roasts || roasts.length === 0 ? (
          <div className="bg-card border-2 border-foreground rounded-3xl p-10 text-center shadow-brutal">
            <p className="text-4xl mb-3">🦗</p>
            <p className="font-serif italic text-lg">nobody in {areaName} has been roasted yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              be the first — or go peek at{" "}
              <button
                type="button"
                onClick={() => setActive("global")}
                className="underline decoration-wavy underline-offset-4 font-bold"
              >
                everywhere else
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {roasts.map((roast) => (
              <RoastCardLink key={roast.username} roast={roast} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
