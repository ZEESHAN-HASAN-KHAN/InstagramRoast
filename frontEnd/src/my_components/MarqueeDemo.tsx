import { cn } from "@/lib/utils";
import Marquee from "@/components/ui/marquee";
import cr from "../assets/cr.png";
import lm from "../assets/lm.png";
import nj from "../assets/nj.png";
import bk from "../assets/bk.png";
import vk from "../assets/vk.png";
import dj from "../assets/dj.png";
import { Link } from "react-router-dom";

const reviews = [
  { name: "Cristiano Ronaldo", username: "cristiano", body: "Finally, an app brave enough to roast me. Respect.", img: cr },
  { name: "Leo Messi", username: "leomessi", body: "This app said I dribble better than I speak. Rude but true.", img: lm },
  { name: "Neymar Jr", username: "neymarjr", body: "It called me a drama king. Who told them?", img: nj },
  { name: "Dwayne Johnson", username: "therock", body: "Said I look like a boulder, not a rock. Savage.", img: dj },
  { name: "Virat Kohli", username: "virat.kohli", body: "This app said I argue with umpires for fun. Ouch.", img: vk },
  { name: "David Beckham", username: "davidbeckham", body: "Apparently, my haircuts are more famous than I am.", img: bk },
];

const TILE_BGS = [
  "bg-yellow-100 dark:bg-yellow-900/30",
  "bg-pink-100 dark:bg-pink-900/30",
  "bg-sky-100 dark:bg-sky-900/30",
  "bg-green-100 dark:bg-green-900/30",
  "bg-purple-100 dark:bg-purple-900/30",
];

const firstRow = reviews.slice(0, reviews.length / 2);
const secondRow = reviews.slice(reviews.length / 2);

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 24 24" className="inline size-4 text-sky-500" fill="currentColor" aria-label="Verified">
      <path d="M12 2l2.39 1.74 2.96-.34.95 2.82 2.49 1.62-.94 2.82.94 2.82-2.49 1.62-.95 2.82-2.96-.34L12 22l-2.39-1.74-2.96.34-.95-2.82L3.21 16.16l.94-2.82-.94-2.82 2.49-1.62.95-2.82 2.96.34L12 2zm-1.1 13.3l5.3-5.3-1.4-1.4-3.9 3.9-1.6-1.6-1.4 1.4 3 3z" />
    </svg>
  );
}

const ReviewCard = ({
  img, name, username, body, index,
}: {
  img: string; name: string; username: string; body: string; index: number;
}) => {
  const bg = TILE_BGS[index % TILE_BGS.length];
  const rot = index % 2 ? "rotate-[1deg]" : "-rotate-[1deg]";
  return (
    <Link to={"/" + username} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      <figure
        className={cn(
          "group shrink-0 w-[300px] cursor-pointer border-2 border-foreground rounded-3xl p-5 transition-all hover:-translate-y-1 hover:rotate-0 shadow-[5px_5px_0_0_hsl(0_0%_8%)]",
          bg, rot
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              className="size-12 rounded-full bg-background border-2 border-foreground object-cover shrink-0"
              width="48"
              height="48"
              alt={name}
              src={img}
            />
            <span className="absolute -bottom-1 -right-1 text-base">🔥</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-sm truncate">
              {name}
              <VerifiedBadge />
            </div>
            <p className="text-xs font-mono text-muted-foreground truncate">@{username}</p>
          </div>
        </div>
        <blockquote className="mt-4 text-sm font-serif italic text-foreground/90 leading-relaxed line-clamp-3">
          "{body}"
        </blockquote>
      </figure>
    </Link>
  );
};

export function MarqueeDemo() {
  return (
    <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <Marquee pauseOnHover className="[--duration:30s] [--gap:20px]">
        {firstRow.map((review, i) => (
          <ReviewCard key={review.username} {...review} index={i} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="[--duration:30s] [--gap:20px] mt-5">
        {secondRow.map((review, i) => (
          <ReviewCard key={review.username} {...review} index={i + 3} />
        ))}
      </Marquee>
    </div>
  );
}
