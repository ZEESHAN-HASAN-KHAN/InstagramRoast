import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SelectDemo } from "./SelectDemo";
import { createToken } from "@/lib/utils";
import NumberTicker from "@/components/ui/number-ticker";

export function Hero() {
  const [uname, setUname] = useState("");
  const [roastCount, setRoastCount] = useState(0);
  const [language, setLanguage] = useState("english");
  const navigate = useNavigate();

  const handleValueChange = (value: string) => setLanguage(value);

  const discover = () => {
    const cleaned = uname.trim().replace(/^@+/, "");
    if (!cleaned) return;
    navigate(`/${cleaned}?language=${language}`);
  };

  const getRoastCount = async () => {
    try {
      const url = import.meta.env.VITE_APP_BASE_URL;
      const token = await createToken();
      const result = await fetch(url + "/api/v1/roastCount", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await result.json();
      setRoastCount(data.count);
    } catch (error) {
      console.error("Error fetching roast count:", error);
    }
  };

  useEffect(() => { getRoastCount(); }, []);

  return (
    <section className="relative pt-16 pb-24 px-6 overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-20 -right-20 size-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-72 rounded-full bg-yellow-300/20 blur-3xl" />

      {/* Floating emoji stickers */}
      <div className="pointer-events-none hidden lg:block absolute top-24 left-4 xl:left-12 animate-float">
        <div className="bg-yellow-200 dark:bg-yellow-900/40 p-4 shadow-brutal border-2 border-foreground rotate-[-8deg] rounded-2xl text-5xl">🔥</div>
      </div>
      <div className="pointer-events-none hidden lg:block absolute top-44 right-4 xl:right-12 animate-float [animation-delay:1s]">
        <div className="bg-pink-200 dark:bg-pink-900/40 p-4 shadow-brutal border-2 border-foreground rotate-[10deg] rounded-2xl text-5xl">😂</div>
      </div>
      <div className="pointer-events-none hidden lg:block absolute bottom-16 left-6 xl:left-20 animate-float [animation-delay:2s]">
        <div className="bg-sky-200 dark:bg-sky-900/40 p-4 shadow-brutal border-2 border-foreground rotate-[6deg] rounded-2xl text-5xl">💀</div>
      </div>
      <div className="pointer-events-none hidden lg:block absolute bottom-32 right-10 animate-float [animation-delay:3s]">
        <div className="bg-green-200 dark:bg-green-900/40 p-4 shadow-brutal border-2 border-foreground rotate-[-12deg] rounded-2xl text-5xl">🤡</div>
      </div>

      <div className="max-w-4xl mx-auto text-center relative">
        {/* Stats badge */}
        <div className="animate-reveal inline-flex items-center gap-2 bg-foreground text-background px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest rotate-[-2deg] shadow-md">
          <span className="animate-pulse-dot text-primary">●</span>
          <NumberTicker value={roastCount} /> egos toasted 🍞
        </div>

        {/* Headline */}
        <h1 className="animate-reveal [animation-delay:100ms] mt-8 text-5xl md:text-8xl font-serif italic font-bold tracking-tight text-balance leading-[0.95]">
          the AI with{" "}
          <span className="inline-block bg-yellow-200 dark:bg-yellow-900/40 px-2 -rotate-2 border-2 border-foreground rounded-xl">
            zero
          </span>{" "}
          <br className="hidden sm:block" />
          chill 🌶️{" "}
          <span className="text-primary underline decoration-wavy decoration-accent underline-offset-[10px]">
            roasts you
          </span>
        </h1>

        <p className="animate-reveal [animation-delay:200ms] mt-8 text-lg md:text-xl text-foreground/80 max-w-xl mx-auto">
          drop your @handle. our judgmentally-challenged AI will read you to filth in 10 seconds. it's mean, it's accurate, it's <em>free</em>. 💸
        </p>

        {/* Input form */}
        <div className="animate-reveal [animation-delay:300ms] mt-12">
          <form
            onSubmit={(e) => { e.preventDefault(); discover(); }}
            className="max-w-lg mx-auto"
          >
            <div className="flex flex-col sm:flex-row gap-2 p-2 bg-card border-2 border-foreground rounded-3xl shadow-brutal focus-within:shadow-brutal-lg transition-all rotate-[-0.5deg]">
              <div className="flex items-center flex-1 min-w-0 px-4 gap-2">
                <span className="text-xl">👉</span>
                <input
                  type="text"
                  value={uname}
                  onChange={(e) => setUname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && discover()}
                  placeholder="@your_handle_here"
                  aria-label="Instagram handle"
                  className="flex-1 min-w-0 py-3 bg-transparent outline-none text-lg font-mono placeholder:text-muted-foreground/60 text-foreground"
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black uppercase tracking-wider hover:-translate-y-0.5 hover:rotate-1 transition-all cursor-pointer border-2 border-foreground shadow-[3px_3px_0_0_hsl(0_0%_8%)]"
              >
                roast me 🔥
              </button>
            </div>
            <div className="mt-4 flex flex-col items-center gap-2">
              <SelectDemo language={language} onValueChange={handleValueChange} />
              <p className="text-xs text-muted-foreground italic">
                ⚠️ by clicking you accept your ego may not survive.
              </p>
            </div>
          </form>
        </div>

        {/* Social proof */}
        <div className="mt-12 animate-reveal [animation-delay:400ms] flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-3 py-1.5 text-xs font-bold rotate-[-2deg] shadow-[3px_3px_0_0_hsl(0_0%_8%)] hover:-translate-y-1 hover:rotate-0 transition-all cursor-default">
            ⭐⭐⭐⭐⭐ <span className="text-muted-foreground">"hurt my feelings"</span>
          </span>
          <span className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-3 py-1.5 text-xs font-bold rotate-[2deg] shadow-[3px_3px_0_0_hsl(0_0%_8%)] hover:-translate-y-1 hover:rotate-0 transition-all cursor-default">
            🏆 #1 on product hunt
          </span>
        </div>

        {/* Product Hunt badge */}
        <div className="mt-8 animate-reveal [animation-delay:500ms]">
          <a
            href="https://www.producthunt.com/posts/instaroasts-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-instaroasts&#0045;2"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=702163&theme=light"
              alt="InstaRoasts on Product Hunt"
              style={{ width: "200px", height: "50px" }}
              className="mx-auto"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
