import { useState } from "react";
import { track } from "@/lib/analytics";

type ShareBarProps = {
  title: string;
  text: string;
};

export function ShareBar({ title, text }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const caption = `${title}\n\n${text}\n\n${url}`;
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

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  // Instagram publishes nothing from a URL — there is no intent endpoint like
  // the others have. On a phone the OS share sheet is the real route (it lists
  // Instagram alongside everything else); everywhere else the best we can do is
  // load the caption into the clipboard and open Instagram for the paste.
  async function shareToInstagram() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title}\n\n${text}`, url });
        track("share_clicked", { channel: "Instagram", method: "web_share" });
        setNote(null);
        return;
      } catch (err) {
        // Dismissing the sheet is a deliberate "no" — don't yank them to
        // instagram.com behind their back.
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    const didCopy = await copyToClipboard(caption);
    track("share_clicked", { channel: "Instagram", method: didCopy ? "copy_open" : "open_only" });
    setNote(
      didCopy
        ? "caption copied — paste it in your story or DM 📋"
        : "copy the roast, then paste it in your story or DM 📋"
    );
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    track("share_clicked", { channel: "copy_link" });
    if (await copyToClipboard(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="font-serif italic text-base">share the burn →</span>
        <button
          type="button"
          onClick={shareToInstagram}
          className="bg-gradient-to-br from-fuchsia-200 to-orange-200 dark:from-fuchsia-900/50 dark:to-orange-900/40 -rotate-2 inline-flex items-center gap-2 border-2 border-foreground hover:-translate-y-1 hover:rotate-0 transition-all px-3 py-2 rounded-full text-sm font-bold shadow-[3px_3px_0_0_hsl(0_0%_8%)]"
        >
          <span className="text-lg">📸</span>
          Instagram
        </button>
        {targets.map((t, i) => (
          <a
            key={t.name}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("share_clicked", { channel: t.name })}
            className={`${t.bg} ${i % 2 ? "-rotate-2" : "rotate-2"} inline-flex items-center gap-2 border-2 border-foreground hover:-translate-y-1 hover:rotate-0 transition-all px-3 py-2 rounded-full text-sm font-bold shadow-[3px_3px_0_0_hsl(0_0%_8%)]`}
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
      {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
