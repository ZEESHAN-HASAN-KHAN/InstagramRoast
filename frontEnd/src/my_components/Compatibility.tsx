import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SelectDemo } from "./SelectDemo";
import { track } from "@/lib/analytics";
import { cleanHandle } from "@/lib/utils";
import { signForDate, maxBirthDate } from "@/lib/zodiac";

// One person's half of the form: handle + optional birthday. Extracted because
// the two sides are identical and the sign chip has enough logic that copying
// it twice would guarantee they drift.
function PersonField({
  label,
  handle,
  onHandleChange,
  dob,
  onDobChange,
}: {
  label: string;
  handle: string;
  onHandleChange: (value: string) => void;
  dob: string;
  onDobChange: (value: string) => void;
}) {
  const sign = signForDate(dob);

  return (
    <div className="flex-1 w-full space-y-2">
      <input
        required
        type="text"
        value={handle}
        onChange={(e) => onHandleChange(e.target.value.trim())}
        placeholder={label}
        className="w-full px-4 py-3 bg-background border-2 border-foreground rounded-2xl font-mono outline-none focus:shadow-[3px_3px_0_0_hsl(var(--primary))] transition-all text-foreground placeholder:text-muted-foreground"
      />
      <div className="relative">
        <input
          type="date"
          value={dob}
          max={maxBirthDate()}
          min="1900-01-01"
          onChange={(e) => onDobChange(e.target.value)}
          aria-label={`${label} birthday, optional`}
          className="w-full px-4 py-2 bg-background border-2 border-dashed border-foreground/40 rounded-2xl font-mono text-sm outline-none focus:border-solid focus:border-foreground focus:shadow-[3px_3px_0_0_hsl(var(--primary))] transition-all text-foreground"
        />
        {/* The payoff for filling in a date, shown the instant it is picked —
            this is what makes the extra field feel worth it rather than like
            one more thing standing between them and the result. */}
        {sign && (
          <span className="absolute -top-2 right-3 bg-pink-200 dark:bg-pink-900/60 border-2 border-foreground rounded-full px-2 text-[11px] font-black uppercase tracking-wide animate-reveal">
            {sign.emoji} {sign.name}
          </span>
        )}
      </div>
    </div>
  );
}

export function Compatibility() {
  const [uname1, setUname1] = useState("");
  const [uname2, setUname2] = useState("");
  const [dob1, setDob1] = useState("");
  const [dob2, setDob2] = useState("");
  const [language, setLanguage] = useState("english");
  const navigate = useNavigate();

  const handleValueChange = (value: string) => setLanguage(value);

  function discover(a: string, b: string): void {
    // `cosmic` distinguishes the astrology reading from the plain pairing in
    // reporting — the whole point of the feature is that it converts and
    // shares better, and that is unanswerable if both look the same in GA.
    track("compatibility_submitted", {
      language,
      variant: dob1 || dob2 ? "cosmic" : "plain",
    });

    const params = new URLSearchParams({ uname1: a, uname2: b, language });
    // Omitted entirely rather than sent empty, so a shared link stays short and
    // the absence of a date is unambiguous on the way back in.
    if (dob1) params.set("dob1", dob1);
    if (dob2) params.set("dob2", dob2);
    navigate(`/compatibilityRoast?${params.toString()}`);
  }

  const bothSigns = signForDate(dob1) && signForDate(dob2);

  return (
    <section id="cosmic-match" className="scroll-mt-20 py-20 px-6 border-t-2 border-foreground bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute top-10 -right-20 size-60 rounded-full bg-pink-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-20 size-60 rounded-full bg-primary/10 blur-3xl" />

      <div className="max-w-2xl mx-auto relative">
        <div className="text-center mb-10">
          <span className="inline-block bg-foreground text-background px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider rotate-[-2deg] mb-4">
            ✨ cosmic match
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold italic text-balance">
            are you two{" "}
            <span className="inline-block bg-pink-200 dark:bg-pink-900/40 px-2 -rotate-1 border-2 border-foreground rounded-xl">
              written in the stars
            </span>
            ?
          </h2>
          <p className="mt-4 text-foreground/70">
            Two Instagram profiles, two birthdays. The AI reads both feeds and both charts,
            then tells you exactly how this ends. 🔮
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Cleaned at submit, not on keystroke — stripping the @ while they
            // type fights the cursor.
            const a = cleanHandle(uname1);
            const b = cleanHandle(uname2);
            if (a && b && a.toLowerCase() !== b.toLowerCase()) {
              discover(a, b);
            } else {
              alert("Please fill in both usernames. Also, they should be different.");
            }
          }}
          className="bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[-0.3deg]"
        >
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <PersonField
              label="@username1"
              handle={uname1}
              onHandleChange={setUname1}
              dob={dob1}
              onDobChange={setDob1}
            />
            <div className="shrink-0 mx-auto sm:mt-3 size-10 bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground rounded-full flex items-center justify-center font-black text-xs shadow-[3px_3px_0_0_hsl(var(--brutal))]">
              VS
            </div>
            <PersonField
              label="@username2"
              handle={uname2}
              onHandleChange={setUname2}
              dob={dob2}
              onDobChange={setDob2}
            />
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            {bothSigns
              ? "🔮 both charts locked in. this one is going to hurt."
              : "birthdays are optional, but the reading is meaner with them"}
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <SelectDemo language={language} onValueChange={handleValueChange} />
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black uppercase tracking-wider hover:-translate-y-0.5 transition-all cursor-pointer border-2 border-foreground shadow-[4px_4px_0_0_hsl(var(--brutal))]"
            >
              read our stars ✨
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
