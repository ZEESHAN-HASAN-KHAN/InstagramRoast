import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function RoastCard({ roast }: { roast: string }) {
  const renderedMarkdown = useMemo(
    () => (
      <div className="prose break-words whitespace-normal font-serif text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{roast}</ReactMarkdown>
      </div>
    ),
    [roast]
  );

  return (
    <div className="relative">
      <div className="absolute -top-6 -left-3 text-4xl rotate-[-18deg] animate-float pointer-events-none select-none">
        🔥
      </div>
      <div className="absolute -top-8 right-4 text-5xl rotate-[14deg] animate-float [animation-delay:1s] pointer-events-none select-none">
        💀
      </div>
      <div className="absolute -bottom-6 -right-3 text-4xl rotate-[12deg] animate-float [animation-delay:2s] pointer-events-none select-none">
        🤡
      </div>

      <article className="relative bg-gradient-to-br from-yellow-100 via-orange-100 to-pink-100 dark:from-yellow-900/30 dark:via-orange-900/30 dark:to-pink-900/30 border-2 border-foreground rounded-3xl p-8 md:p-10 shadow-brutal rotate-[-0.6deg]">
        <div className="absolute -top-4 left-6 bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full rotate-[-4deg] shadow-md">
          🎤 hot take
        </div>
        <span
          aria-hidden
          className="absolute -top-2 left-2 font-serif italic text-8xl text-primary leading-none select-none opacity-70"
        >
          "
        </span>
        <div className="relative pt-4 font-serif text-lg md:text-xl leading-relaxed text-foreground">
          {renderedMarkdown}
        </div>
        <div className="mt-8 pt-6 border-t-2 border-dashed border-foreground/30 flex items-center justify-between text-sm">
          <span className="font-bold">— your AI bestie 😈</span>
          <span className="text-2xl">✨🌶️✨</span>
        </div>
      </article>
    </div>
  );
}
