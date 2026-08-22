import { useEffect, useState } from "react";

type Sign = { name: string; emoji?: string; element?: string };

// Bands use the site's flat pastel tint blocks rather than raw hex, so the
// score reads correctly in both themes and stays inside the existing palette.
// Colour is the fastest read on the page — the number is what gets
// screenshotted — but it has to be the site's colour, not a new one.
const BANDS = [
  {
    min: 80,
    label: "written in the stars",
    tint: "bg-lime-200 dark:bg-lime-900/40",
    stroke: "stroke-lime-400 dark:stroke-lime-500",
    glow: "bg-lime-400/40 dark:bg-lime-500/30",
    sticker: "🔮",
  },
  {
    min: 60,
    label: "annoyingly promising",
    tint: "bg-yellow-200 dark:bg-yellow-900/40",
    stroke: "stroke-yellow-400 dark:stroke-yellow-500",
    glow: "bg-yellow-400/40 dark:bg-yellow-500/30",
    sticker: "✨",
  },
  {
    min: 40,
    label: "chaotic neutral",
    tint: "bg-orange-200 dark:bg-orange-900/40",
    stroke: "stroke-orange-400 dark:stroke-orange-500",
    glow: "bg-orange-400/40 dark:bg-orange-500/30",
    sticker: "🎲",
  },
  {
    min: 20,
    label: "structurally doomed",
    tint: "bg-pink-200 dark:bg-pink-900/40",
    stroke: "stroke-pink-400 dark:stroke-pink-500",
    glow: "bg-pink-400/40 dark:bg-pink-500/30",
    sticker: "💔",
  },
  {
    min: 0,
    label: "cosmically illegal",
    tint: "bg-rose-200 dark:bg-rose-900/40",
    stroke: "stroke-rose-500 dark:stroke-rose-600",
    glow: "bg-rose-500/40 dark:bg-rose-600/35",
    sticker: "💀",
  },
];

const bandFor = (score: number) => BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];

const ZODIAC_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

// Ring geometry, in the SVG's 130-unit viewBox. The stroke is deliberately
// heavy: a hairline arc would read as a dashboard gauge, and nothing else on
// this site is drawn thinner than 2px.
const RING_WIDTH = 12;
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Counts the score up on reveal. The number climbing is what makes people wait
// for it instead of scrolling past — a static integer reads as a data point, a
// climbing one reads as a verdict being delivered.
function useCountUp(target: number | null, durationMs = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === null) return;

    // Honour the same preference the CSS animations do; a number sprinting
    // upward is exactly the kind of motion this setting exists to stop.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return target === null ? null : value;
}

// Zodiac glyphs orbiting the score plate. Each glyph counter-rotates against
// its own ring at the same duration, so the symbols stay upright instead of
// tumbling as they travel.
//
// Hidden from the accessibility tree: a screen reader announcing twelve loose
// symbols before the result would bury it. The score itself is labelled on the
// ring's role="img" below.
// `radius` is a percentage of the container's width, not pixels. The container
// is size-64 on mobile and size-72 above it, so a fixed pixel radius would put
// the inner orbit outside the plate on one breakpoint and inside it on the
// other. Percentages keep both orbits in the same place relative to the plate
// at every size.
function GlyphRing({ radius, reverse }: { radius: number; reverse?: boolean }) {
  return (
    <div aria-hidden className={`absolute inset-0 ${reverse ? "zodiac-orbit-reverse" : "zodiac-orbit"}`}>
      {ZODIAC_GLYPHS.map((glyph, i) => {
        const angle = (i / ZODIAC_GLYPHS.length) * 2 * Math.PI;
        return (
          <span
            key={glyph}
            className={`absolute -translate-x-1/2 -translate-y-1/2 leading-none ${
              reverse ? "text-[11px] text-foreground/25" : "text-sm text-foreground/40"
            }`}
            style={{
              left: `${50 + Math.cos(angle) * radius}%`,
              top: `${50 + Math.sin(angle) * radius}%`,
            }}
          >
            <span className={`block ${reverse ? "zodiac-glyph-reverse" : "zodiac-glyph"}`}>{glyph}</span>
          </span>
        );
      })}
    </div>
  );
}

function SignBadge({
  sign,
  handle,
  avatar,
  tilt,
}: {
  sign: Sign | null;
  handle: string;
  avatar?: string | null;
  tilt: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 min-w-0 ${tilt}`}>
      <div className="relative">
        {/* Same gradient ring InstaCard puts around an avatar, so a profile
            looks like a profile everywhere on the site. */}
        <div className="size-20 rounded-full p-1 bg-gradient-to-tr from-primary via-pink-400 to-accent border-2 border-foreground">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              loading="lazy"
              className="size-full rounded-full object-cover bg-background"
            />
          ) : (
            <div className="size-full rounded-full bg-background" />
          )}
        </div>
        {sign?.emoji && (
          <span className="absolute -bottom-1 -right-1 grid place-items-center size-8 rounded-full bg-card border-2 border-foreground text-base shadow-[2px_2px_0_0_hsl(var(--brutal))]">
            {sign.emoji}
          </span>
        )}
      </div>
      <div className="text-center min-w-0">
        {sign && (
          <p className="inline-block font-mono text-xs font-bold bg-secondary border border-border px-2 py-0.5 rounded -rotate-1">
            {sign.name}
          </p>
        )}
        <p className="mt-1 font-mono text-[11px] text-muted-foreground truncate max-w-[12ch]">
          @{handle}
        </p>
      </div>
    </div>
  );
}

export function CosmicVerdict({
  score,
  sign1,
  sign2,
  handle1,
  handle2,
  avatar1,
  avatar2,
  greenFlag,
  redFlag,
  verdict,
}: {
  score: number | null;
  sign1: Sign | null;
  sign2: Sign | null;
  handle1: string;
  handle2: string;
  avatar1?: string | null;
  avatar2?: string | null;
  greenFlag: string | null;
  redFlag: string | null;
  verdict: string | null;
}) {
  const displayScore = useCountUp(score);

  // Nothing structured came back — the caller falls through to the plain
  // markdown card rather than rendering an empty scaffold.
  if (score === null && !greenFlag && !redFlag && !verdict) return null;

  const band = bandFor(score ?? 0);

  return (
    <section className="relative bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[-0.4deg] flex flex-col gap-7">
      {/* Ambient wash, same device as the hero's background blobs.
          The clip lives on this inner layer rather than on the section, because
          overflow-hidden on the section would cut off the corner stickers that
          deliberately hang outside the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[calc(1.5rem-2px)]"
      >
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full blur-3xl opacity-60 ${band.glow}`}
        />
        <div className="absolute -bottom-20 -right-16 size-56 rounded-full bg-accent/15 blur-3xl" />
      </div>
      {/* Corner stickers, same floating-emoji device the hero and the roast
          card use. Hidden on small screens where they would crowd the ring. */}
      <span
        aria-hidden
        className="pointer-events-none select-none hidden sm:block absolute -top-7 -left-4 z-10 text-4xl rotate-[-16deg] animate-float"
      >
        {band.sticker}
      </span>
      <span
        aria-hidden
        className="pointer-events-none select-none hidden sm:block absolute -top-8 right-2 z-10 text-4xl rotate-[12deg] animate-float [animation-delay:1s]"
      >
        ✨
      </span>

      <div className="relative flex items-start justify-center gap-3 sm:gap-8">
        <SignBadge sign={sign1} handle={handle1} avatar={avatar1} tilt="rotate-[-2deg]" />

        <div className="shrink-0 mt-6 grid place-items-center size-10 rounded-full bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground font-black text-xs shadow-[3px_3px_0_0_hsl(var(--brutal))]">
          VS
        </div>

        <SignBadge sign={sign2} handle={handle2} avatar={avatar2} tilt="rotate-[2deg]" />
      </div>

      {/* The score. The ring sits on a bordered plate with the site's hard
          offset shadow, so it reads as one of the page's physical objects
          rather than a floating gauge. Butt caps, not round: the arc gets a
          cut edge like everything else here. */}
      {score !== null && (
        <div className="relative flex flex-col items-center gap-5">
          <div className="relative size-64 sm:size-72">
            <div
              aria-hidden
              className={`halo-breathe pointer-events-none absolute inset-[6%] rounded-full blur-3xl ${band.glow}`}
            />
            <GlyphRing radius={47} />
            <GlyphRing radius={43} reverse />

            <div className="absolute inset-[12%] rounded-full border-2 border-foreground bg-background shadow-[6px_6px_0_0_hsl(var(--brutal))]">
              <svg
                viewBox="0 0 130 130"
                className="absolute inset-0 size-full -rotate-90"
                role="img"
                aria-label={`Cosmic match score ${score} out of 100: ${band.label}`}
              >
                <circle
                  cx="65"
                  cy="65"
                  r={RING_RADIUS}
                  className="fill-none stroke-foreground/10"
                  strokeWidth={RING_WIDTH}
                />
                <circle
                  cx="65"
                  cy="65"
                  r={RING_RADIUS}
                  className={`score-ring fill-none ${band.stroke}`}
                  strokeWidth={RING_WIDTH}
                  strokeDasharray={RING_CIRCUMFERENCE}
                  style={
                    {
                      "--ring-circumference": `${RING_CIRCUMFERENCE}`,
                      "--ring-offset": `${RING_CIRCUMFERENCE * (1 - score / 100)}`,
                    } as React.CSSProperties
                  }
                />
                {/* Thin outline on the inside edge of the track, so the arc
                    terminates against a drawn line instead of fading out. */}
                <circle
                  cx="65"
                  cy="65"
                  r={RING_RADIUS - RING_WIDTH / 2}
                  className="fill-none stroke-foreground/30"
                  strokeWidth="1"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif font-bold italic text-6xl leading-[1.1] pb-1 tabular-nums">
                  {displayScore}
                </span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  out of 100
                </span>
              </div>
            </div>
          </div>

          <span
            className={`${band.tint} border-2 border-foreground rounded-full px-4 py-1 text-xs font-black uppercase tracking-wider rotate-[-1.5deg] shadow-[3px_3px_0_0_hsl(var(--brutal))] animate-pop`}
          >
            {band.label}
          </span>
        </div>
      )}

      {(greenFlag || redFlag) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {greenFlag && (
            <div className="relative bg-lime-200 dark:bg-lime-900/40 border-2 border-foreground rounded-2xl p-5 pt-6 shadow-[4px_4px_0_0_hsl(var(--brutal))] rotate-[-0.5deg] animate-reveal">
              <span className="absolute -top-3 left-4 bg-card border-2 border-foreground text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                🟢 green flag
              </span>
              <p className="font-serif text-[15px] leading-snug">{greenFlag}</p>
            </div>
          )}
          {redFlag && (
            <div className="relative bg-rose-200 dark:bg-rose-900/40 border-2 border-foreground rounded-2xl p-5 pt-6 shadow-[4px_4px_0_0_hsl(var(--brutal))] rotate-[0.5deg] animate-reveal [animation-delay:120ms]">
              <span className="absolute -top-3 left-4 bg-card border-2 border-foreground text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                🔴 red flag
              </span>
              <p className="font-serif text-[15px] leading-snug">{redFlag}</p>
            </div>
          )}
        </div>
      )}

      {verdict && (
        <div className="pt-5 border-t-2 border-dashed border-foreground/30 text-center animate-reveal [animation-delay:240ms]">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            💀 how this ends
          </p>
          <p className="mt-2 font-serif italic text-xl leading-[1.35] pb-1">{verdict}</p>
        </div>
      )}
    </section>
  );
}
