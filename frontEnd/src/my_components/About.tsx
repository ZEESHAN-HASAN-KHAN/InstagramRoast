import { MarqueeDemo } from "./MarqueeDemo";

const FEATURES = [
  {
    icon: "💀",
    title: "no filter, no mercy",
    body: "our AI doesn't care about your feelings or your curated aesthetic. it sees right through the vibe.",
    bg: "bg-pink-200 dark:bg-pink-900/40",
    rotate: "-rotate-1",
  },
  {
    icon: "🧠",
    title: "data-driven snark",
    body: "advanced linguistic analysis of your captions to figure out exactly how many therapy sessions you need.",
    bg: "bg-yellow-200 dark:bg-yellow-900/40",
    rotate: "rotate-1",
  },
  {
    icon: "📱",
    title: "shareable shame",
    body: "pretty roast cards ready to post back to the platform that just got you cooked. circle of life.",
    bg: "bg-sky-200 dark:bg-sky-900/40",
    rotate: "-rotate-1",
  },
];

export function About() {
  return (
    <>
      {/* Features section */}
      <section id="features" className="py-24 bg-background relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] mb-4">
              ✨ why it slaps
            </span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold italic text-balance">
              three reasons you'll cry 😭
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`${f.bg} ${f.rotate} border-2 border-foreground rounded-3xl p-6 shadow-brutal hover:rotate-0 hover:-translate-y-1 transition-all`}
              >
                <div className="size-14 bg-background rounded-2xl border-2 border-foreground grid place-items-center text-3xl mb-4 -rotate-6">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-serif font-bold italic mb-2">{f.title}</h3>
                <p className="text-foreground/80 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Roasts / Trending section */}
      <section id="about" className="py-20 bg-background border-y-2 border-foreground overflow-hidden relative">
        <div className="max-w-3xl mx-auto px-6 text-center mb-10">
          <span className="inline-block bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] mb-4 border-2 border-foreground">
            🍿 hall of flame
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold italic tracking-tight text-balance">
            freshly cooked celebs <span aria-hidden className="not-italic">📈</span>
          </h2>
          <p className="mt-4 text-foreground/70">
            the most-roasted profiles our AI chewed through this week. tap any card for the full carnage. 🔪
          </p>
        </div>
        <MarqueeDemo />
      </section>
    </>
  );
}
