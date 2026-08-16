import { useEffect, useState } from "react";
import { getCardCounts } from "@/lib/api";
import { auraRing } from "@/lib/cardAura";
import { RARITIES, RARITY_ORDER, type RarityId } from "@/lib/cardRarity";
import { useSeen } from "@/hooks/useSeen";

// What's actually in the deck, rarest first. Every roast mints exactly one card
// and the roll is pure luck, so the only way a pull means anything to someone
// is if they can see what they *could* have got — a Golden Roast is a shrug
// until you know 55% of people get a Mid.
//
// The observed mint counts sit next to the design probabilities because they're
// the half people believe: "4.5% pull rate" is a claim, "only 61 have ever been
// pulled" is a scoreboard.

// Rarest first — the opposite of RARITY_ORDER, which runs worst to best.
const TIERS: RarityId[] = [...RARITY_ORDER].reverse();

/** The rate a bar would need to fill the row. */
const MAX_RATE = Math.max(...RARITY_ORDER.map((id) => RARITIES[id].pullRate));

// Square-rooted, not linear. At true scale a 0.5% bar is a single pixel next to
// the 55% one and the rarest row — the whole point of the table — reads as
// broken rather than rare. The printed number stays exact.
const barWidth = (rate: number) => `${Math.max(5, Math.sqrt(rate / MAX_RATE) * 100)}%`;

/** "1 in 200" lands harder than "0.5%", so both are printed. */
const oneIn = (rate: number) => {
  const n = 100 / rate;
  return n < 10 ? n.toFixed(1).replace(/\.0$/, "") : Math.round(n).toLocaleString();
};

function OddsRow({
  tier,
  index,
  minted,
  highlighted,
}: {
  tier: RarityId;
  index: number;
  minted: number | null;
  highlighted: boolean;
}) {
  const rarity = RARITIES[tier];
  const ring = auraRing(tier, 0.7);
  // Only the two tiers people actually chase get the sweep; on the common rows
  // it would read as decoration rather than as "this one is special".
  const chased = tier === "diamond" || tier === "golden";

  return (
    <div
      className={`relative flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 transition-colors ${
        highlighted ? "bg-background" : "bg-card"
      } ${ring?.className ?? "border-foreground"}`}
      style={{ ...(ring?.style ?? {}), animationDelay: `${index * 90}ms` }}
      title={ring?.title}
    >
      <span className="text-2xl leading-none shrink-0">{rarity.emoji}</span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-black uppercase tracking-wide">{rarity.name}</span>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {rarity.pullRate}% · 1 in {oneIn(rarity.pullRate)}
          </span>
          {highlighted && (
            <span className="rounded-full bg-foreground text-background px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
              yours
            </span>
          )}
        </span>

        {/* The bar is the whole point of showing this as a table rather than a
            list: five numbers don't compare, five lengths do. */}
        <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <span
            className="card-odds-bar relative block h-full overflow-hidden rounded-full"
            style={{
              width: barWidth(rarity.pullRate),
              background: "rgb(var(--aura))",
              animationDelay: `${150 + index * 90}ms`,
            }}
          >
            {chased && (
              <span
                aria-hidden="true"
                className="card-odds-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-white/60 blur-[2px]"
              />
            )}
          </span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block text-sm font-black tabular-nums">
          {minted === null ? "—" : minted.toLocaleString()}
        </span>
        <span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          ever pulled
        </span>
      </span>
    </div>
  );
}

export function CardOdds({
  highlight = null,
  title = "🎴 what's in the deck",
}: {
  /** The viewer's own tier, called out in the table. */
  highlight?: RarityId | null;
  title?: string;
}) {
  const [counts, setCounts] = useState<Partial<Record<string, number>> | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  // `tier` is the viewer's own pull where there is one, so the report can show
  // whether people who landed a rare card look at the odds more than the rest.
  const seenRef = useSeen<HTMLDivElement>("card_odds_viewed", {
    tier: highlight ?? "none",
    surface: highlight ? "roast" : "leaderboard",
  });

  useEffect(() => {
    let cancelled = false;
    getCardCounts()
      .then((data) => {
        if (cancelled) return;
        setCounts(data.counts);
        setTotal(data.total);
      })
      // Counts are the bonus half. Without them the table still explains the
      // deck, so a failed lookup just leaves dashes.
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={seenRef}
      className="bg-card border-2 border-foreground rounded-3xl p-5 md:p-6 shadow-brutal"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="font-serif italic font-bold text-xl">{title}</h3>
        {total !== null && (
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground tabular-nums">
            {total.toLocaleString()} cards minted
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        every roast mints exactly one. rarity is pure luck — re-roll for another roll of the dice.
      </p>

      <div className="space-y-2">
        {TIERS.map((tier, i) => (
          <OddsRow
            key={tier}
            tier={tier}
            index={i}
            minted={counts ? counts[tier] ?? 0 : null}
            highlighted={highlight === tier}
          />
        ))}
      </div>
    </div>
  );
}
