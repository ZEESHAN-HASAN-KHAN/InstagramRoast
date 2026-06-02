import { useState } from "react";

type ShareBarProps = {
  title: string;
  text: string;
};

export function ShareBar({ title, text }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const shareText = encodeURIComponent(`${title}\n\n${text}`);
  const shareUrl = encodeURIComponent(url);

  const targets = [
    {
      name: "Tweet it",
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
      emoji: "🐦",
      bg: "bg-sky-200 dark:bg-sky-900/40",
    },
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${shareText}%20${shareUrl}`,
      emoji: "💬",
      bg: "bg-green-200 dark:bg-green-900/40",
    },
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      emoji: "💼",
      bg: "bg-blue-200 dark:bg-blue-900/40",
    },
    {
      name: "Threads",
      href: `https://www.threads.net/intent/post?text=${shareText}`,
      emoji: "🧵",
      bg: "bg-purple-200 dark:bg-purple-900/40",
    },
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <span className="font-serif italic text-base">share the burn →</span>
      {targets.map((t, i) => (
        <a
          key={t.name}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${t.bg} ${i % 2 ? "rotate-2" : "-rotate-2"} inline-flex items-center gap-2 border-2 border-foreground hover:-translate-y-1 hover:rotate-0 transition-all px-3 py-2 rounded-full text-sm font-bold shadow-[3px_3px_0_0_hsl(0_0%_8%)]`}
        >
          <span className="text-lg">{t.emoji}</span>
          {t.name}
        </a>
      ))}
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground border-2 border-foreground hover:-translate-y-1 transition-all px-4 py-2 rounded-full text-sm font-black shadow-[3px_3px_0_0_hsl(0_0%_8%)]"
      >
        {copied ? "✅ copied!" : "🔗 copy link"}
      </button>
    </div>
  );
}
