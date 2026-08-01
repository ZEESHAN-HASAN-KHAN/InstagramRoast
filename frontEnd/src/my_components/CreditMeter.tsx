import { useEffect, useState } from "react";
import { getCredits, type CreditsInfo } from "@/lib/api";

// Balance snapshot for the current visitor. Null while loading or on failure —
// callers should render nothing in that case rather than guessing.
export function useCredits() {
  const [credits, setCredits] = useState<CreditsInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCredits()
      .then((data) => {
        if (!cancelled) setCredits(data);
      })
      .catch(() => {
        // A missing meter is invisible; a wrong meter is a broken promise.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return credits;
}

// Small pill that tells the visitor where they stand BEFORE the paywall does.
// The wall converts far better when it isn't a surprise — "last free roast"
// primes the purchase decision one step early.
export function CreditMeter({ className = "" }: { className?: string }) {
  const credits = useCredits();

  // Loading, failed, or a region where roasts are free — show nothing.
  if (!credits || !credits.monetizationEnabled) return null;

  const freeLeft = Math.max(0, (credits.freeLimit ?? 0) - (credits.freeUsed ?? 0));
  const paid = credits.paidCredits ?? 0;

  let label: string;
  let tone = "bg-card";
  if (paid > 0) {
    label = `🎟️ ${paid} paid roast${paid === 1 ? "" : "s"} banked${
      freeLeft > 0 ? ` · ${freeLeft} free left` : ""
    }`;
  } else if (freeLeft > 1) {
    label = `🎟️ ${freeLeft} free roasts left`;
  } else if (freeLeft === 1) {
    label = "⚠️ last free roast — make it count";
    tone = "bg-yellow-200 dark:bg-yellow-900/40";
  } else {
    label = "😤 free roasts used up";
    tone = "bg-muted";
  }

  return (
    <span
      className={`inline-flex items-center gap-2 ${tone} border-2 border-foreground rounded-full px-3 py-1.5 text-xs font-bold shadow-[3px_3px_0_0_hsl(0_0%_8%)] ${className}`}
    >
      {label}
    </span>
  );
}
