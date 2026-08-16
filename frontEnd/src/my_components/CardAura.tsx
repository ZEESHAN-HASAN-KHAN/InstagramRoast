import { auraTitle, auraVars } from "@/lib/cardAura";
import type { RarityId } from "@/lib/cardRarity";

/**
 * The lit panel: a burning border, glow bleeding inward from it, and fire
 * rising off the bottom edge — the tier of the card this profile pulled.
 *
 * Absolutely positioned, so the only thing the caller owes it is `position:
 * relative` and a border radius to inherit. It sits above anything static
 * underneath it, so text that would otherwise be tinted by the flames needs to
 * be positioned too.
 *
 * Renders nothing at all for a card nobody has opened — see lib/cardAura.ts.
 *
 * @param fire drop it on surfaces too small or too crowded for flames; the
 *             burning border alone still reads as the tier
 */
export function CardAura({
  tier,
  intensity = 1,
  fire = true,
}: {
  tier: RarityId | null | undefined;
  intensity?: number;
  fire?: boolean;
}) {
  if (!tier) return null;

  return (
    <span
      aria-hidden="true"
      title={auraTitle(tier)}
      style={auraVars(tier, intensity)}
      className="card-aura-panel"
    >
      {fire && <span className="card-aura-flame" />}
    </span>
  );
}
