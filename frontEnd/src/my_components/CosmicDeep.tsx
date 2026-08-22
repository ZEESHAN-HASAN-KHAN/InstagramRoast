import { useEffect, useState } from "react";
import { fetchDeepReading, type DeepReading, type PaywallInfo } from "@/lib/api";
import { track } from "@/lib/analytics";
import { Paywall } from "./Paywall";

// The paid half of Cosmic Match.
//
// One gate, not six. The free reading already gives away a score, two flags and
// a verdict; what is sold here is length and specificity, which is the only
// thing a reader cannot infer from the teaser. Locking each section behind its
// own padlock was the mistake the roast page made — a wall of them reads as
// spam and converts worse than a single honest one.

// Ruling planet per section, mirroring SECTIONS in backEnd/helpers/cosmicDeep.js.
//
// Duplicated here on purpose rather than relied on from the response: the
// mapping is a fixed convention, and readings bought before the server started
// sending it replay from cache without one. Looking it up locally means an old
// reading still gets its artwork instead of six blank cards.
const PLANETS: Record<string, string> = {
  loveLanguage: "♀",
  communication: "☿",
  theFight: "♂",
  chemistry: "♇",
  forecast: "☽",
  theFix: "♄",
};

// Shown under the blur before anything is bought. These are the real section
// titles, so the buyer knows exactly what they are getting; the bodies are
// decorative bars, never fake text - inventing sentences that then get replaced
// would be lying about the product.
const TEASER_SECTIONS = [
  { key: "loveLanguage", icon: "💕", title: "How you each show up", lines: 3 },
  { key: "communication", icon: "💬", title: "Who texts first", lines: 2 },
  { key: "theFight", icon: "⚡", title: "The fight you will keep having", lines: 3 },
  { key: "chemistry", icon: "🔥", title: "The chemistry", lines: 2 },
  { key: "forecast", icon: "🔮", title: "Six-month forecast", lines: 2 },
  { key: "theFix", icon: "🔧", title: "What would have to change", lines: 2 },
];

// How a section landed, decided by the model rather than by keyword-matching
// the body text here: the reading is written in whichever of the ten supported
// languages the user chose, and an English keyword list would call every
// Spanish or Hinglish section neutral.
type Tone = "blessed" | "tense" | "cursed";

const TONE_STYLES: Record<Tone, { tint: string; badge: string; omen: string; label: string }> = {
  blessed: {
    tint: "bg-lime-50 dark:bg-lime-950/30",
    badge: "bg-lime-200 dark:bg-lime-900/50",
    omen: "🌿",
    label: "in your favour",
  },
  tense: {
    tint: "bg-yellow-50 dark:bg-yellow-950/25",
    badge: "bg-yellow-200 dark:bg-yellow-900/50",
    omen: "⚖️",
    label: "could go either way",
  },
  cursed: {
    tint: "bg-rose-50 dark:bg-rose-950/30",
    badge: "bg-rose-200 dark:bg-rose-900/50",
    omen: "🔥",
    label: "this is the problem",
  },
};

// Visible, turning astro mark behind each card: a dashed orbit ring with the
// section's ruling planet riding it. Previously a 7%-opacity glyph, which read
// as a smudge at any size. Opacity is up, the ring gives it structure, and the
// two rotate against each other so it looks like an orbit rather than a
// spinning sticker.
function OrbitMark({ planet, delay, size }: { planet: string; delay: number; size: "md" | "lg" }) {
  const box = size === "lg" ? "size-52" : "size-36";
  const glyph = size === "lg" ? "text-7xl" : "text-5xl";

  return (
    <span aria-hidden className={`pointer-events-none absolute -bottom-10 -right-8 ${box}`}>
      <svg viewBox="0 0 100 100" className="orbit-ring absolute inset-0 size-full" style={{ animationDelay: `${delay}s` }}>
        <circle
          cx="50"
          cy="50"
          r="44"
          className="fill-none stroke-current opacity-25"
          strokeWidth="1"
          strokeDasharray="3 6"
        />
        <circle cx="50" cy="6" r="2.5" className="fill-current opacity-30" />
      </svg>
      <span
        className={`planet-drift absolute inset-0 grid place-items-center ${glyph} leading-none select-none opacity-25`}
        style={{ animationDelay: `${delay}s` }}
      >
        {planet}
      </span>
    </span>
  );
}

function SectionCard({
  icon,
  title,
  children,
  index,
  planet,
  tone = "tense",
  showOmen = true,
  wide = false,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  index: number;
  planet?: string;
  tone?: Tone;
  showOmen?: boolean;
  wide?: boolean;
}) {
  const style = TONE_STYLES[tone];

  return (
    <article
      className={`relative rounded-3xl border-2 border-foreground ${style.tint} ${
        wide ? "p-6 pt-8 md:p-8 md:pt-9 sm:col-span-2" : "p-5 pt-7"
      } shadow-[4px_4px_0_0_hsl(var(--brutal))] animate-reveal ${
        index % 2 === 0 ? "rotate-[-0.4deg]" : "rotate-[0.4deg]"
      }`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* The clip lives on this wrapper, NOT on the article: overflow-hidden on
          the card would slice the header chips in half, since they deliberately
          hang over the top edge at -top-3. Inset by the 2px border so the mark
          never paints over it. */}
      {planet && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[calc(1.5rem-2px)] text-foreground"
        >
          <OrbitMark planet={planet} delay={index * -14} size={wide ? "lg" : "md"} />
        </span>
      )}

      <span className="absolute -top-3 left-4 z-10 inline-flex items-center gap-1.5 bg-secondary border-2 border-foreground rounded-full px-2.5 py-0.5 max-w-[calc(100%-4.5rem)]">
        <span className="text-sm leading-none shrink-0">{icon}</span>
        <h3 className="text-[10px] font-black uppercase tracking-wider truncate">{title}</h3>
        {/* The planet named next to the title, small but legible. The watermark
            is atmosphere; this is the part a reader can actually connect to
            copy that says "Mercury compels" three lines down. */}
        {planet && <span className="text-xs leading-none text-muted-foreground shrink-0">{planet}</span>}
      </span>

      {/* Omen badge, icon only. It used to carry its label, which collided with
          the title chip on the two-column grid and clipped both. The legend
          above the grid names what each omen means; the glyph and the card tint
          carry it here, and the words stay in the accessible name. Suppressed on
          the locked teaser: promising a verdict the buyer has not paid for would
          be inventing one, and the tone is part of what is sold. */}
      {showOmen && (
        <span
          className={`omen-in absolute -top-3 right-4 z-10 grid place-items-center size-7 ${style.badge} border-2 border-foreground rounded-full`}
          style={{ animationDelay: `${index * 80 + 260}ms` }}
          role="img"
          aria-label={style.label}
          title={style.label}
        >
          <span className="text-xs leading-none">{style.omen}</span>
        </span>
      )}

      <div className="relative">{children}</div>
    </article>
  );
}

function LockedPreview() {
  return (
    <div className="relative">
      {/* The blurred stack is inert: no focusable children, hidden from screen
          readers, and pointer events off — otherwise a keyboard user tabs
          through six cards of nothing on the way to the unlock button. */}
      {/* Same rhythm the unlocked reading uses, so the shape a buyer sees under
          the blur is the shape they get. The forecast and the fix run full
          width there; if they did not here, unlocking would rearrange the page
          under the reader. */}
      <div className="grid gap-5 sm:grid-cols-2 select-none pointer-events-none" aria-hidden>
        {TEASER_SECTIONS.map((section, i) => (
          <SectionCard
            key={section.key}
            icon={section.icon}
            title={section.title}
            index={i}
            planet={PLANETS[section.key]}
            showOmen={false}
            wide={section.key === "forecast" || section.key === "theFix"}
          >
            <div className="space-y-2 blur-[5px]">
              {Array.from({ length: section.lines }).map((_, line) => (
                <div
                  key={line}
                  className="h-3 rounded-full bg-foreground/25"
                  style={{ width: `${92 - line * 14}%` }}
                />
              ))}
            </div>
          </SectionCard>
        ))}
      </div>

      {/* Sweep across the blur — the cue that there is real content underneath
          rather than an empty placeholder. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
        <div className="locked-sheen absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-card via-card/90 to-transparent"
        aria-hidden
      />
    </div>
  );
}

export function CosmicDeep({
  uname1,
  uname2,
  language,
  dob1,
  dob2,
  score,
}: {
  uname1: string;
  uname2: string;
  language: string;
  dob1: string | null;
  dob2: string | null;
  score: number | null;
}) {
  const [reading, setReading] = useState<DeepReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [paywall, setPaywall] = useState<PaywallInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Denominator for deep_reading_clicked. Without it the unlock button has a
  // click count and no impression count, so its conversion rate is unknowable.
  // Fires once per mount, which is once per delivered cosmic match.
  useEffect(() => {
    track("deep_reading_shown", { surface: "cosmic" });
  }, []);

  async function unlock() {
    setLoading(true);
    setError(null);
    track("deep_reading_clicked", { surface: "cosmic", variant: score !== null ? "scored" : "plain" });

    try {
      const result = await fetchDeepReading({ uname1, uname2, language, dob1, dob2 });
      // A 402 comes back as the paywall payload itself, not wrapped.
      if ("paywall" in result) {
        setPaywall(result);
        track("paywall_shown", { surface: "cosmic_deep" });
        return;
      }
      setReading(result.reading);
      track("deep_reading_delivered", {
        surface: "cosmic",
        // A cached unlock is a repeat view, not a new sale. Kept apart so the
        // conversion rate is not inflated by people reopening their own link.
        result: result.cached ? "cached" : "fresh",
      });
    } catch (err) {
      // Split from the paywall path on purpose: a 502 from an unreadable model
      // response and a visitor who simply has no credits are opposite problems,
      // and both used to leave the funnel as a silent drop after the click.
      track("deep_reading_failed", { surface: "cosmic" });
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Checkout takes over the screen, same as it does for a roast. On success the
  // unlock is retried automatically so the purchase lands the reading without a
  // second click.
  if (paywall) {
    return (
      <Paywall
        info={paywall}
        surface="cosmic_deep"
        onUnlocked={() => {
          setPaywall(null);
          void unlock();
        }}
      />
    );
  }

  if (reading) {
    const fallbackTone: Tone = score === null ? "tense" : score >= 60 ? "blessed" : score >= 30 ? "tense" : "cursed";
    // Pulled out of the grid and rendered as the closing statement. Optional,
    // because a model that skipped the section still yields a valid reading.
    const theFix = reading.sections.find((sec) => sec.key === "theFix");

    return (
      <section className="flex flex-col gap-5">
        <header className="text-center">
          <span className="inline-block bg-lime-200 dark:bg-lime-900/40 border-2 border-foreground px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] shadow-[3px_3px_0_0_hsl(var(--brutal))]">
            🔓 unlocked
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl font-serif font-bold italic leading-[1.15] pb-1">
            @{uname1} × @{uname2}, in detail
          </h2>

          {/* The shape of the reading in one line. Only tones actually present
              are listed, so a reading that came back all-cursed shows one
              entry instead of two zeroes. */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {(["blessed", "tense", "cursed"] as Tone[])
              .map((t) => ({ t, n: reading.sections.filter((sec) => (sec.tone ?? fallbackTone) === t).length }))
              .filter(({ n }) => n > 0)
              .map(({ t, n }) => (
                <span
                  key={t}
                  className={`inline-flex items-center gap-1.5 ${TONE_STYLES[t].badge} border-2 border-foreground rounded-full px-3 py-0.5`}
                >
                  <span className="text-xs leading-none">{TONE_STYLES[t].omen}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {n} {TONE_STYLES[t].label}
                  </span>
                </span>
              ))}
          </div>
        </header>

        {/* Rhythm, not a uniform 2x3. Six identically-sized cards give the eye
            nowhere to land and make a long reading feel like a form. The two
            sections that are actually the payoff get the full width:
            the forecast because it moves through time, and the fix because it
            is the punchline the other five build to. */}
        <div className="grid gap-5 sm:grid-cols-2">
          {reading.sections
            .filter((section) => section.key !== "theFix")
            .map((section, i) => (
              <SectionCard
                key={section.key}
                icon={section.icon}
                title={section.title}
                index={i}
                planet={section.planet ?? PLANETS[section.key]}
                // Readings bought before tones existed replay from cache
                // without one. Rather than inventing a tone from the text,
                // fall back to the pair's overall score, the only honest
                // signal an old reading carries.
                tone={section.tone ?? fallbackTone}
                wide={section.key === "forecast"}
              >
                <p
                  className={`font-serif leading-relaxed text-foreground/90 ${
                    section.key === "forecast" ? "text-base md:text-lg max-w-[62ch]" : "text-[15px]"
                  }`}
                >
                  {section.body}
                </p>
              </SectionCard>
            ))}
        </div>

        {/* The finale. Inverted, full width, no tone tint: this section is the
            one honest thing in the reading and it should not look like the five
            jokes above it. */}
        {theFix && (
          <article className="finale-lift relative rounded-3xl border-2 border-foreground bg-foreground text-background p-7 pt-9 md:p-10 shadow-brutal animate-reveal [animation-delay:520ms]">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[calc(1.5rem-2px)] text-background"
            >
              <OrbitMark planet={theFix.planet ?? PLANETS.theFix} delay={-70} size="lg" />
            </span>

            <span className="absolute -top-3 left-6 z-10 inline-flex items-center gap-1.5 bg-background text-foreground border-2 border-foreground rounded-full px-3 py-0.5">
              <span className="text-sm leading-none">{theFix.icon}</span>
              <h3 className="text-[10px] font-black uppercase tracking-wider">{theFix.title}</h3>
              <span className="text-xs leading-none text-muted-foreground">
                {theFix.planet ?? PLANETS.theFix}
              </span>
            </span>

            <p className="relative font-serif italic text-lg md:text-2xl leading-[1.45] pb-1 max-w-[52ch]">
              {theFix.body}
            </p>
          </article>
        )}
      </section>
    );
  }

  return (
    <section className="relative bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[0.3deg]">
      <span
        aria-hidden
        className="pointer-events-none select-none hidden sm:block absolute -top-8 right-4 text-4xl rotate-[14deg] animate-float"
      >
        🔮
      </span>

      <div className="relative flex flex-col gap-8">
        <header className="text-center">
          <span className="inline-block bg-yellow-200 dark:bg-yellow-900/40 border-2 border-foreground px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] shadow-[3px_3px_0_0_hsl(var(--brutal))]">
            🔒 still locked
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl font-serif font-bold italic text-balance leading-[1.15] pb-1">
            {score !== null && score < 40
              ? "You saw the score. Want to know why?"
              : "Six sections you have not read yet"}
          </h2>
          <p className="mt-3 text-sm text-foreground/70 max-w-md mx-auto">
            Who texts first, the fight you will keep having, a month-by-month forecast, and the one
            thing that would actually have to change.
          </p>
        </header>

        <LockedPreview />

        <div className="flex flex-col items-center gap-3 -mt-4">
          <button
            type="button"
            onClick={unlock}
            disabled={loading}
            className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3.5 rounded-2xl font-black uppercase tracking-wider border-2 border-foreground shadow-[4px_4px_0_0_hsl(var(--brutal))] hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait disabled:translate-y-0"
          >
            {loading ? "reading the chart…" : "unlock the full reading ✨"}
          </button>
          <p className="text-xs text-muted-foreground italic">one unlock, all six sections</p>
          {error && <p className="text-xs text-destructive font-bold">{error}</p>}
        </div>
      </div>
    </section>
  );
}
