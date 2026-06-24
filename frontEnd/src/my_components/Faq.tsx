import { useState } from "react";
import { Helmet } from "react-helmet";

const FAQS = [
  {
    q: "can I roast anyone? 🎯",
    a: "Yes!! You can roast & analyse anyone as long as their data is publicly available on the internet.",
  },
  {
    q: "is this free? 💸",
    a: "Yes!! It's completely free. No credit card, no sign-up, no excuses.",
  },
  {
    q: "how long does it take? ⏱️",
    a: "Most roasts take around 10–20 seconds. If it takes longer than that, please contact us!",
  },
  {
    q: "how long do you store my data? 🔒",
    a: "we don't store your photos. we read your public data, cook up the roast, then forget you ever existed. classy.",
  },
  {
    q: "can I roast a profile multiple times? 🔄",
    a: "Yes! Each re-scan works the same as the first. We version your roasts so you can compare iterations over time.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map(({ q, a }) => ({
    "@type": "Question",
    "name": q.replace(/[\u{1F300}-\u{1FFFF}]/gu, "").trim(),
    "acceptedAnswer": {
      "@type": "Answer",
      "text": a,
    },
  })),
};

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-background relative overflow-hidden">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>
      <div className="pointer-events-none absolute top-20 -left-20 size-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 -right-20 size-72 rounded-full bg-primary/20 blur-3xl" />

      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 relative">
        {/* About story */}
        <div>
          <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider -rotate-2 mb-4">
            👋 wait, what?
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold italic mb-6 text-balance">
            it started as a{" "}
            <span className="bg-yellow-200 dark:bg-yellow-900/40 px-2 inline-block -rotate-1 border-2 border-foreground rounded-xl">
              joke
            </span>
          </h2>
          <p className="text-lg leading-relaxed text-foreground/80 mb-4">
            a group of devs got tired of seeing "inspirational" coffee cups and gym mirror selfies. so we built a model fueled by comedy specials and the meanest corners of the internet. 🎤🔥
          </p>
          <p className="text-lg leading-relaxed text-foreground/80">
            it's all in good fun. mostly. if you're offended, you're probably the target audience. 🫶
          </p>
        </div>

        {/* FAQ accordion */}
        <div className="space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            const rot = i % 2 ? "rotate-[0.5deg]" : "-rotate-[0.5deg]";
            return (
              <div
                key={item.q}
                className={`${rot} bg-card border-2 border-foreground rounded-2xl shadow-[4px_4px_0_0_hsl(0_0%_8%)] overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex justify-between items-center text-left font-bold p-4 gap-4"
                  aria-expanded={isOpen}
                >
                  <span className="font-serif italic text-lg">{item.q}</span>
                  <span
                    className={`shrink-0 size-8 grid place-items-center bg-primary text-primary-foreground rounded-full font-black transition-transform ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
                <p
                  className={`px-4 pb-4 text-foreground/80 ${isOpen ? "animate-reveal" : "hidden"}`}
                >
                  {item.a}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
