import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Marquee from "@/components/ui/marquee";
import { getRecentFeed, type RecentFeed } from "@/lib/api";

// Compact relative time — "just now", "4m", "3h", "2d".
function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RoastTicker() {
  const [feed, setFeed] = useState<RecentFeed | null>(null);

  useEffect(() => {
    let cancelled = false;
    // "city" asks for the tightest scope; the backend widens on its own until it
    // has enough to show and tells us which scope actually answered.
    getRecentFeed("city")
      .then((data) => {
        if (!cancelled) setFeed(data);
      })
      .catch(() => {
        if (!cancelled) setFeed(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to brag about yet — an empty or near-empty strip reads as broken,
  // so the whole section stays out of the page.
  if (!feed || feed.roasts.length < 3) return null;

  const isLocal = feed.scope !== "global" && !!feed.label;

  return (
    <section className="py-6 border-y-2 border-foreground bg-card/50 overflow-hidden">
      <p className="text-center text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
        {isLocal ? `🔥 freshly roasted in ${feed.label}` : "🔥 freshly roasted"}
      </p>

      <Marquee pauseOnHover className="[--duration:45s]">
        {feed.roasts.map((roast) => (
          <Link
            key={roast.username}
            to={`/${roast.username}?language=english`}
            className="inline-flex items-center gap-3 bg-card border-2 border-foreground rounded-full pl-1.5 pr-4 py-1.5 shadow-[3px_3px_0_0_hsl(0_0%_8%)] hover:-translate-y-1 hover:rotate-1 transition-all"
          >
            {roast.profile_pic_url ? (
              <img
                src={roast.profile_pic_url}
                alt=""
                loading="lazy"
                className="size-8 rounded-full border-2 border-foreground object-cover shrink-0"
              />
            ) : (
              <span className="size-8 rounded-full border-2 border-foreground bg-muted shrink-0" />
            )}
            <span className="text-sm font-bold whitespace-nowrap">
              @{roast.username}
              <span className="font-normal text-muted-foreground"> got roasted {timeAgo(roast.created_at)}</span>
            </span>
            <span className="text-lg">💀</span>
          </Link>
        ))}
      </Marquee>
    </section>
  );
}
