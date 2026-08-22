import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Compatibility } from "./Compatibility";

// Standalone landing page for Cosmic Match.
//
// The reason it exists is the traffic mix: 54% of sessions arrive from Google
// organic and effectively none from social. An anchor on the home page cannot
// rank, because it has no URL of its own to rank with. "zodiac compatibility"
// and "birth chart compatibility" are search terms with real volume; "instagram
// roast" is a niche. This page is the one asset aimed at the bigger term.
//
// So it carries prose as well as the form. A page that is only a form has
// nothing for a crawler to read and nothing for a visitor arriving cold to
// decide from.

// Each glyph carries U+FE0E, the text-presentation selector. Without it the
// system emoji font claims U+2648-2653 and paints fixed-colour tiles that
// ignore currentColor, so the band rendered as purple stickers on a white strip
// instead of monochrome type.
const ZODIAC = [
  "♈︎", "♉︎", "♊︎", "♋︎",
  "♌︎", "♍︎", "♎︎", "♏︎",
  "♐︎", "♑︎", "♒︎", "♓︎",
];

// Tints come from the three the hero already floats as stickers, so the page
// reads as part of the same site rather than a landing page bolted onto it.
const STEPS = [
  {
    n: "1",
    icon: "📇",
    title: "Two handles",
    body: "Whoever you are curious about. Yours and theirs, a friend and their ex, two celebrities.",
    tint: "bg-yellow-200 dark:bg-yellow-900/40",
    tilt: "rotate-[-1.2deg]",
  },
  {
    n: "2",
    icon: "🎂",
    title: "Two birthdays",
    body: "Just the dates. No birth time, no birth city, no account to make.",
    tint: "bg-pink-200 dark:bg-pink-900/40",
    tilt: "rotate-[0.8deg]",
  },
  {
    n: "3",
    icon: "💀",
    title: "One verdict",
    body: "The AI reads both feeds and both charts, then scores the pair out of 100 and says how it ends.",
    tint: "bg-sky-200 dark:bg-sky-900/40",
    tilt: "rotate-[-0.6deg]",
  },
];

const FAQ = [
  {
    q: "Do I need their birth time?",
    a: "No. Cosmic Match uses sun signs, which need only the date. A full natal chart needs the time and the city, and asking for three things instead of one is how people give up halfway.",
  },
  {
    q: "Does it work if I only know one birthday?",
    a: "Yes. The reading runs with one date and has something to say about the person who would not tell you theirs.",
  },
  {
    q: "Do I have to log in or connect my Instagram?",
    a: "No. It reads public profile data from the handles you type. There is nothing to connect and no password to give anyone.",
  },
  {
    q: "What is in the full reading?",
    a: "Six sections: how you each show up, who texts first, the fight you will keep having, the chemistry, a six-month forecast, and the one thing that would have to change.",
  },
  {
    q: "Is it serious?",
    a: "No. It is a comedy tool that is mean about two Instagram accounts. Do not end a relationship over it.",
  },
];

// Reveals its element once, when it scrolls into view. Everything here is below
// the fold, so the site's mount-time animate-reveal would have finished playing
// long before anyone saw it.
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    // No IntersectionObserver: show it rather than leave the page blank.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return { ref, className: shown ? "reveal-in" : "reveal-hidden" };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, className: revealClass } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`${revealClass} ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function CosmicMatchPage() {
  const url = "https://instaroasts.com/cosmic-match";

  return (
    <div>
      <Helmet>
        <title>Cosmic Match 🔮 — AI Zodiac Compatibility for Two Instagram Profiles</title>
        <meta
          name="description"
          content="Two Instagram handles, two birthdays. The AI reads both feeds and both star signs, scores you out of 100, and tells you exactly how it ends. Free, no login."
        />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />

        {/* FAQPage markup, matching the questions actually rendered below.
            Google drops the rich result when the two disagree, so these are
            generated from the same array rather than written out twice. */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          })}
        </script>
      </Helmet>

      {/* The form is the page's job, so it goes first. Everything under it is
          for the crawler and for the visitor who wants to know what this is
          before typing a friend's handle into it. */}
      <Compatibility />

      {/* Zodiac band. The one marquee on the page, and it earns its place by
          being the subject rather than decoration. */}
      <div className="overflow-hidden border-y-2 border-foreground bg-foreground text-background py-2.5">
        <div className="zodiac-band flex w-max">
          {/* Two identical halves, each at least one viewport wide.

              The gap came from the halves being narrower than the screen: 24
              glyphs at their natural width ran out before the right edge on a
              wide monitor. min-w-[100vw] stops that, and justify-around spreads
              them over whatever width the screen turns out to be.

              The units matter. A percentage translate resolves against the
              element's OWN border box, so the track has to be w-max (200vw) for
              -50% to equal exactly one half. With the track at 100% instead,
              -50% would be half a viewport while the repeat period is a whole
              one, and the band would jump every cycle. Percentages on the
              children are equally unusable, since they would resolve against a
              parent whose width their own content defines.

              aria-hidden throughout: repeating symbols are noise to a screen
              reader, and the band carries no information. */}
          {[0, 1].map((half) => (
            <div
              key={half}
              aria-hidden
              className="flex min-w-[100vw] shrink-0 items-center justify-around text-xl"
            >
              {[...ZODIAC, ...ZODIAC].map((glyph, i) => (
                <span key={i} className="opacity-80 select-none px-2">
                  {glyph}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="relative overflow-hidden px-6 py-20 bg-background">
        {/* Ambient blobs, the hero's device. Clipped by the section. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -right-24 size-72 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/3 size-72 rounded-full bg-yellow-300/20 blur-3xl"
        />

        <div className="relative max-w-3xl mx-auto space-y-16">
          <Reveal className="text-center">
            <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest rotate-[-2deg] mb-4">
              🔮 how it works
            </span>
            <h1 className="text-3xl md:text-4xl font-serif font-bold italic text-balance leading-[1.15] pb-1">
              AI zodiac compatibility, judged on your{" "}
              <span className="inline-block bg-pink-200 dark:bg-pink-900/40 px-2 -rotate-1 border-2 border-foreground rounded-xl">
                actual Instagram
              </span>
            </h1>
            <p className="mt-4 text-foreground/70 max-w-xl mx-auto">
              Most compatibility quizzes only know your star sign. This one also reads what the two
              of you actually post, which is where the evidence is.
            </p>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 110}>
                <div
                  className={`relative h-full ${step.tint} border-2 border-foreground rounded-3xl p-5 pt-7 shadow-brutal ${step.tilt} hover:rotate-0 hover:-translate-y-1 transition-transform`}
                >
                  <span className="absolute -top-4 left-4 grid place-items-center size-9 rounded-full bg-primary text-primary-foreground border-2 border-foreground font-black shadow-[3px_3px_0_0_hsl(var(--brutal))]">
                    {step.n}
                  </span>
                  <span
                    aria-hidden
                    className="absolute -top-6 right-3 text-3xl animate-float select-none"
                    style={{ animationDelay: `${i}s` }}
                  >
                    {step.icon}
                  </span>
                  <h2 className="mt-2 font-serif font-bold italic text-xl">{step.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div>
            <Reveal className="text-center">
              <h2 className="text-2xl md:text-3xl font-serif font-bold italic leading-[1.15] pb-1">
                Questions people{" "}
                <span className="inline-block bg-yellow-200 dark:bg-yellow-900/40 px-2 rotate-1 border-2 border-foreground rounded-xl">
                  actually ask
                </span>
              </h2>
            </Reveal>

            <dl className="mt-8 space-y-4">
              {FAQ.map((item, i) => (
                <Reveal key={item.q} delay={i * 70}>
                  <div
                    className={`relative bg-card border-2 border-foreground rounded-2xl p-5 pt-6 shadow-[4px_4px_0_0_hsl(var(--brutal))] hover:-translate-y-0.5 transition-transform ${
                      i % 2 === 0 ? "rotate-[-0.35deg]" : "rotate-[0.35deg]"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="absolute -top-3 left-4 grid place-items-center size-7 rounded-full bg-accent text-accent-foreground border-2 border-foreground text-xs font-black"
                    >
                      ?
                    </span>
                    <dt className="font-black text-sm pl-6">{item.q}</dt>
                    <dd className="mt-2 text-sm text-foreground/70 leading-relaxed">{item.a}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>

          <Reveal>
            <p className="text-center text-xs text-muted-foreground italic max-w-lg mx-auto">
              Cosmic Match is entertainment. It reads public profile data and a birth date, stores
              no birth time or location, and is not advice about anybody's relationship.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
