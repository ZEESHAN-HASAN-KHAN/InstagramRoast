export interface ProgressStep {
  icon: string;
  label: string;
}

interface RoastProgressProps {
  steps: ProgressStep[];
  // Index of the step currently in progress; steps.length means all complete.
  activeIndex: number;
}

// Neo-brutalist step ladder for the loading screen: every step is visible from
// the start, completed ones get a popping checkmark, the active one wiggles
// with pulsing dots. Pair with usePacedIndex so steps never flash by unseen.
export function RoastProgress({ steps, activeIndex }: RoastProgressProps) {
  return (
    <div className="bg-card border-2 border-foreground rounded-3xl p-6 shadow-brutal max-w-md mx-auto">
      <ol className="space-y-3">
        {steps.map((step, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <li
              key={step.label}
              className={`flex items-center gap-3 transition-all duration-300 ${
                isActive ? "scale-[1.03]" : ""
              } ${!isDone && !isActive ? "opacity-35" : ""}`}
            >
              <span
                className={`flex items-center justify-center size-9 shrink-0 rounded-full border-2 border-foreground text-base font-black transition-colors ${
                  isDone
                    ? "bg-green-300 dark:bg-green-800"
                    : isActive
                      ? "bg-yellow-200 dark:bg-yellow-800 animate-bounce"
                      : "bg-muted"
                }`}
              >
                {isDone ? <span className="animate-pop">✓</span> : step.icon}
              </span>
              <span className={`text-sm ${isDone ? "font-bold line-through decoration-2" : isActive ? "font-black" : "font-medium"}`}>
                {step.label}
                {isActive && (
                  <span className="inline-flex ml-1">
                    <span className="animate-pulse-dot">.</span>
                    <span className="animate-pulse-dot [animation-delay:200ms]">.</span>
                    <span className="animate-pulse-dot [animation-delay:400ms]">.</span>
                  </span>
                )}
              </span>
              {isDone && <span className="ml-auto text-xs font-black uppercase tracking-wider text-green-600 dark:text-green-400 animate-pop">done</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
