import { auraRing } from "@/lib/cardAura";
import { formatCount } from "@/lib/utils";
import { CardAura } from "./CardAura";
import type { RarityId } from "@/lib/cardRarity";

export type ProfileData = {
  handle: string;
  displayName: string;
  avatarUrl: string;
  posts: number;
  followers: number;
  following: number;
  bio: string;
};

export function ProfileCard({
  profile,
  cardTier = null,
}: {
  profile: ProfileData;
  /**
   * Tier of the card pulled from this roast, once it's face-up. Null until
   * someone flips it — an unopened card must not be advertised by a glow.
   */
  cardTier?: RarityId | null;
}) {
  const ring = auraRing(cardTier, 1.6);

  return (
    <div className="relative bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[0.5deg]">
      {/* The card's own brutal drop shadow is a box-shadow, and so is the aura —
          hence a layer of its own rather than styling the card element. It also
          clips the flames to the card's corners. */}
      <CardAura tier={cardTier} intensity={2.2} />

      <div className="absolute -top-3 -right-3 bg-accent text-accent-foreground text-xs font-black uppercase px-3 py-1.5 rounded-full rotate-[8deg] shadow-md z-10">
        🎯 target locked
      </div>
      <div className="relative flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="relative shrink-0">
          {/* The tier replaces the default gradient collar when there is one —
              two competing rings around one avatar reads as a mistake. */}
          <div
            {...ring}
            className={`size-28 md:size-32 rounded-full p-1 ${
              ring
                ? `${ring.className} border-2 bg-transparent`
                : "bg-gradient-to-tr from-primary via-pink-400 to-accent"
            }`}
          >
            <img
              src={profile.avatarUrl}
              alt={`${profile.displayName} avatar`}
              className="size-full rounded-full object-cover bg-background"
            />
          </div>
          <span className="absolute -bottom-2 -right-2 text-3xl rotate-12 select-none">🔥</span>
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <a
            href={`https://www.instagram.com/${profile.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-mono text-base font-bold break-all bg-yellow-200 dark:bg-yellow-900/40 px-2 py-0.5 rounded -rotate-1 hover:rotate-0 transition-transform"
          >
            @{profile.handle}
          </a>
          <div className="mt-2 font-serif text-2xl md:text-3xl font-bold italic">
            {profile.displayName}
          </div>
          <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2">
            <Stat emoji="📸" label="posts" value={formatCount(profile.posts)} />
            <Stat emoji="👀" label="followers" value={formatCount(profile.followers)} />
            <Stat emoji="🫶" label="following" value={formatCount(profile.following)} />
          </div>
          {profile.bio && (
            <p className="mt-4 text-sm text-foreground/80 italic">"{profile.bio}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-full px-3 py-1 text-sm">
      <span>{emoji}</span>
      <span className="font-bold">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
