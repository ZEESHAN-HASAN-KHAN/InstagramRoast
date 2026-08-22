import { useEffect, useState } from "react";
import { signForDate, maxBirthDate } from "@/lib/zodiac";
import { track } from "@/lib/analytics";

// Shown on a compatibility result that was run without birth dates.
//
// Without this the page is a dead end: no score, no signs, no flags, no
// verdict, and the paid deep reading is not even offered, because there is no
// chart to read. Nothing on the page said so. Someone who skipped the optional
// date fields had no way to discover what they had skipped, let alone a way
// back.
//
// It asks for the dates in place and re-runs the same pairing rather than
// sending anyone back to the form. The handles are already known; making them
// retype both to add a birthday is the kind of step people abandon.
export function CosmicPrompt({
  uname1,
  uname2,
  onRun,
}: {
  uname1: string;
  uname2: string;
  onRun: (dob1: string, dob2: string) => void;
}) {
  const [dob1, setDob1] = useState("");
  const [dob2, setDob2] = useState("");

  // Denominator for cosmic_prompt_submitted, and on its own the count of
  // pairings that reached a result with nothing to sell.
  useEffect(() => {
    track("cosmic_prompt_shown", { surface: "compat_result" });
  }, []);

  const sign1 = signForDate(dob1);
  const sign2 = signForDate(dob2);
  // One date is enough to run: the reading has a line for the person who would
  // not say, and refusing to proceed on a half-filled form loses more than the
  // second birthday adds.
  const ready = Boolean(dob1 || dob2);

  const field = (
    value: string,
    set: (v: string) => void,
    who: string,
    sign: ReturnType<typeof signForDate>
  ) => (
    <label className="flex-1 min-w-0">
      <span className="block mb-1 text-[11px] font-mono text-muted-foreground truncate">
        @{who} born
      </span>
      <div className="relative">
        <input
          type="date"
          value={value}
          max={maxBirthDate()}
          min="1900-01-01"
          onChange={(e) => set(e.target.value)}
          aria-label={`${who} birthday`}
          className="w-full px-3 py-2.5 bg-background border-2 border-foreground rounded-xl font-mono text-sm outline-none focus:shadow-[3px_3px_0_0_hsl(var(--primary))] transition-all text-foreground"
        />
        {sign && (
          <span className="absolute -top-2 right-2 bg-pink-200 dark:bg-pink-900/60 border-2 border-foreground rounded-full px-2 text-[10px] font-black uppercase animate-reveal">
            {sign.emoji} {sign.name}
          </span>
        )}
      </div>
    </label>
  );

  return (
    <section className="relative bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[0.3deg]">
      <span
        aria-hidden
        className="pointer-events-none select-none hidden sm:block absolute -top-8 right-5 text-4xl rotate-[14deg] animate-float"
      >
        🔮
      </span>

      <div className="relative flex flex-col gap-6">
        <header className="text-center">
          <span className="inline-block bg-yellow-200 dark:bg-yellow-900/40 border-2 border-foreground px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] shadow-[3px_3px_0_0_hsl(var(--brutal))]">
            ✨ you skipped the stars
          </span>
          <h2 className="mt-4 text-2xl md:text-3xl font-serif font-bold italic text-balance leading-[1.15] pb-1">
            Two birthdays and this gets a lot worse
          </h2>
          <p className="mt-2 text-sm text-foreground/70 max-w-md mx-auto">
            You ran this without birth dates, so there was no chart to read. Add them and the AI
            reads both feeds and both signs.
          </p>
        </header>

        {/* Named rather than blurred. A blur teases something that does not
            exist yet; this pairing has no reading to hide, so the honest move
            is to list what running it again produces. */}
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          {[
            { icon: "💯", label: "a compatibility score out of 100" },
            { icon: "♌", label: "both star signs and how they clash" },
            { icon: "🟢", label: "a green flag and a red flag" },
            { icon: "💀", label: "the verdict on how it ends" },
          ].map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2 bg-background border-2 border-foreground rounded-xl px-3 py-2"
            >
              <span aria-hidden className="text-base leading-none shrink-0">
                {item.icon}
              </span>
              <span className="font-serif leading-tight">{item.label}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row gap-3">
          {field(dob1, setDob1, uname1, sign1)}
          <div className="hidden sm:grid place-items-center shrink-0 size-9 mt-5 rounded-full bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground font-black text-xs shadow-[3px_3px_0_0_hsl(var(--brutal))]">
            VS
          </div>
          {field(dob2, setDob2, uname2, sign2)}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              track("cosmic_prompt_submitted", {
                surface: "compat_result",
                variant: dob1 && dob2 ? "both" : "one",
              });
              onRun(dob1, dob2);
            }}
            className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3.5 rounded-2xl font-black uppercase tracking-wider border-2 border-foreground shadow-[4px_4px_0_0_hsl(var(--brutal))] hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            read our stars ✨
          </button>
          <p className="text-xs text-muted-foreground italic">
            {ready ? "one birthday is enough. two is meaner." : "add at least one birthday"}
          </p>
        </div>
      </div>
    </section>
  );
}
