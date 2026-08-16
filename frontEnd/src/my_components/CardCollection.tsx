import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCardCollection, type RevealedCard } from "@/lib/api";
import { track } from "@/lib/analytics";
import { asRarityId, auraRing } from "@/lib/cardAura";
import { RARITIES, RARITY_ORDER } from "@/lib/cardRarity";
import { useSeen } from "@/hooks/useSeen";

// What the leaderboard means when it credits a profile with "2 cards · 2
// tiers". Every re-roll mints a genuinely different card, so a profile that has
// been roasted more than once is sitting on a collection — this is where it
// lives, and the only place the older pulls are visible at all.
//
// Only ever shows cards someone has flipped: the endpoint can't return a
// face-down one, which is what keeps an unopened pull a surprise.

function pulledAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

function CardChip({
  card,
  username,
  current,
}: {
  card: RevealedCard;
  username: string;
  current: boolean;
}) {
  const tier = asRarityId(card.tier);
  if (!tier) return null;

  const rarity = RARITIES[tier];
  const ring = auraRing(tier, 0.9);
  // Opens the roast this card was minted from. `card=<id>` is what gets an
  // older pull back on screen — without it the page would serve the newest
  // roast for that language, which is a different card entirely.
  const href = `/${username}?language=${encodeURIComponent(card.language ?? "english")}${
    current ? "" : `&card=${card.id}`
  }`;

  return (
    <Link
      to={href}
      onClick={() => track("collection_card_opened", { tier, current })}
      className={`flex items-center gap-3 rounded-2xl border-2 bg-card px-3 py-2.5 transition-all hover:-translate-y-0.5 ${
        ring?.className ?? "border-foreground"
      }`}
      {...(ring ? { style: ring.style, title: ring.title } : {})}
    >
      <span className="text-2xl leading-none shrink-0">{rarity.emoji}</span>
      <span className="min-w-0">
        <span className="block text-xs font-black uppercase tracking-wide truncate">
          {rarity.name}
        </span>
        <span className="block text-[10px] font-mono text-muted-foreground tabular-nums">
          {card.serial ? `#${card.serial} · ` : ""}
          {rarity.pullRate}% · {pulledAgo(card.pulled_at)}
        </span>
      </span>
      {/* Tells you which of these is the card sitting above — without it a
          collection of three reads as three unrelated cards. */}
      {current ? (
        <span className="ml-auto shrink-0 rounded-full bg-foreground text-background px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
          on screen
        </span>
      ) : (
        <span className="ml-auto shrink-0 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          read →
        </span>
      )}
    </Link>
  );
}

export function CardCollection({
  username,
  currentSerial,
  /** Bumped by the page whenever a card is flipped, so a fresh pull lands here
   *  immediately rather than on the next visit. */
  refreshKey,
}: {
  username: string;
  currentSerial?: string | null;
  refreshKey?: string | number;
}) {
  const [cards, setCards] = useState<RevealedCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCardCollection(username)
      .then((data) => {
        if (!cancelled) setCards(data.cards);
      })
      // A collection strip is a bonus, never a blocker — a failed lookup just
      // leaves the page as it was.
      .catch(() => {
        if (!cancelled) setCards(null);
      });
    return () => {
      cancelled = true;
    };
  }, [username, refreshKey]);

  const tiers = new Set((cards ?? []).map((c) => c.tier));
  const best = RARITY_ORDER.filter((id) => tiers.has(id)).pop();
  // Hooks can't sit behind the early return below, so the impression is armed
  // unconditionally and only enabled once there's actually a strip to see.
  const seenRef = useSeen<HTMLDivElement>(
    "collection_viewed",
    { cards: cards?.length ?? 0, tiers: tiers.size, tier: best },
    { enabled: (cards?.length ?? 0) >= 2 }
  );

  // One card is already on screen in full, three times this size. A "collection"
  // of exactly one is just the same card again, so the strip starts at two.
  if (!cards || cards.length < 2) return null;

  return (
    <div ref={seenRef} className="bg-card border-2 border-foreground rounded-3xl p-5 md:p-6 shadow-brutal">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="font-serif italic font-bold text-xl">🗃️ the collection</h3>
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground tabular-nums">
          {cards.length} cards · {tiers.size} {tiers.size === 1 ? "tier" : "tiers"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        every card ever pulled from @{username}
        {best ? ` — best so far: ${RARITIES[best].emoji} ${RARITIES[best].name}` : ""}
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {cards.map((card) => (
          <CardChip
            key={card.id}
            card={card}
            username={username}
            current={!!currentSerial && card.serial === currentSerial}
          />
        ))}
      </div>
    </div>
  );
}
