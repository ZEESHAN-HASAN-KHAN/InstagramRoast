import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SelectDemo } from "./SelectDemo";

export function Compatibility() {
  const [uname1, setUname1] = useState("");
  const [uname2, setUname2] = useState("");
  const [language, setLanguage] = useState("english");
  const navigate = useNavigate();

  const handleValueChange = (value: string) => setLanguage(value);

  function discover(): void {
    navigate(`/compatibilityRoast?uname1=${uname1}&uname2=${uname2}&language=${language}`);
  }

  return (
    <section className="py-20 px-6 border-t-2 border-foreground bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute top-10 -right-20 size-60 rounded-full bg-pink-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-20 size-60 rounded-full bg-primary/10 blur-3xl" />

      <div className="max-w-2xl mx-auto relative">
        <div className="text-center mb-10">
          <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] mb-4">
            ❤️‍🔥 new feature
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold italic text-balance">
            check your{" "}
            <span className="inline-block bg-pink-200 dark:bg-pink-900/40 px-2 -rotate-1 border-2 border-foreground rounded-xl">
              compatibility
            </span>
          </h2>
          <p className="mt-4 text-foreground/70">
            How compatible are two Instagram personalities? Let the AI judge. 👀
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (uname1 && uname2 && uname1 !== uname2) {
              discover();
            } else {
              alert("Please fill in both usernames. Also, they should be different.");
            }
          }}
          className="bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[-0.3deg]"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <input
                required
                type="text"
                value={uname1}
                onChange={(e) => setUname1(e.target.value.trim())}
                placeholder="@username1"
                className="w-full px-4 py-3 bg-background border-2 border-foreground rounded-2xl font-mono outline-none focus:shadow-[3px_3px_0_0_hsl(24_72%_52%)] transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="shrink-0 size-10 bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground rounded-full flex items-center justify-center font-black text-xs shadow-[3px_3px_0_0_hsl(0_0%_8%)]">
              VS
            </div>
            <div className="flex-1 w-full">
              <input
                required
                type="text"
                value={uname2}
                onChange={(e) => setUname2(e.target.value.trim())}
                placeholder="@username2"
                className="w-full px-4 py-3 bg-background border-2 border-foreground rounded-2xl font-mono outline-none focus:shadow-[3px_3px_0_0_hsl(24_72%_52%)] transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <SelectDemo language={language} onValueChange={handleValueChange} />
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black uppercase tracking-wider hover:-translate-y-0.5 transition-all cursor-pointer border-2 border-foreground shadow-[4px_4px_0_0_hsl(0_0%_8%)]"
            >
              check compatibility ❤️‍🔥
            </button>
            <p className="text-xs text-muted-foreground italic">
              ⚠️ results may be embarrassing. proceed with caution.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
