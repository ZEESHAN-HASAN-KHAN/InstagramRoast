import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  vertical?: boolean;
  repeat?: number;
  [key: string]: any;
}

export default function Marquee({
  className,
  reverse,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  // A marquee scrolled past the bottom of the window keeps animating, and a
  // translating strip of cards is real compositor work every frame for
  // something nobody can see. Measured on a throttled phone profile it was a
  // few percent of the main thread on its own, permanently. Pause it whenever
  // it is off screen.
  const ref = useRef<HTMLDivElement>(null);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setIdle(!entries.some((e) => e.isIntersecting)),
      // Resume slightly before it scrolls in, so it is never caught frozen.
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      {...props}
      ref={ref}
      data-idle={idle ? "true" : "false"}
      className={cn(
        "group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem] [gap:var(--gap)]",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
        },
        className,
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn("flex shrink-0 justify-around [gap:var(--gap)]", {
              "animate-marquee flex-row": !vertical,
              "animate-marquee-vertical flex-col": vertical,
              "group-hover:[animation-play-state:paused]": pauseOnHover,
              "group-data-[idle=true]:[animation-play-state:paused]": true,
              "[animation-direction:reverse]": reverse,
            })}
          >
            {children}
          </div>
        ))}
    </div>
  );
}
