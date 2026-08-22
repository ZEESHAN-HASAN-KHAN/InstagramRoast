import { useState } from "react";
import { track } from "@/lib/analytics";

type ShareBarProps = {
  title: string;
  text: string;
  /**
   * Which roast is being shared. The same bar renders under a solo roast and a
   * couple roast; without this GA can only report one undifferentiated
   * share_clicked total and there's no way to tell which format actually
   * spreads.
   */
  // Feeds the `source` dimension on every share event. "cosmic" is split out
  // from "compat" deliberately: the astrology reading exists to lift the share
  // rate, and that is unmeasurable if both pairing types report as one value.
  source: "roast" | "compat" | "cosmic";
};

export function ShareBar({ title, text, source }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const caption = `${title}\n\n${text}\n\n${url}`;
  const shareText = encodeURIComponent(`${title}\n\n${text}`);
  const shareUrl = encodeURIComponent(url);

  // `channel` is the reporting key and `name` is the button label. They were
  // the same string, which put "Tweet it" in GA next to "copy_link" — renaming
  // the button would silently split the metric, and the labels don't group.
  const targets = [
    {
      channel: "twitter",
      name: "Tweet it",
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
      emoji: "🐦",
      bg: "bg-sky-200 dark:bg-sky-900/40",
    },
    {
      channel: "whatsapp",
      name: "WhatsApp",
      href: `https://wa.me/?text=${shareText}%20${shareUrl}`,
      emoji: "💬",
      bg: "bg-green-200 dark:bg-green-900/40",
    },
    {
      channel: "linkedin",
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      emoji: "💼",
      bg: "bg-blue-200 dark:bg-blue-900/40",
    },
    {
      channel: "threads",
      name: "Threads",
      href: `https://www.threads.net/intent/post?text=${shareText}`,
      emoji: "🧵",
      bg: "bg-purple-200 dark:bg-purple-900/40",
    },
  ];

  // One shape for every share, so a GA report can break the total down by
  // channel, by how it was shared, and by which roast format it came from
  // without any of the three being missing on some paths.
  const trackShare = (channel: string, method: string) =>
    track("share_clicked", { channel, method, source });

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
        trackShare("instagram", "web_share");
        setNote(null);
        return;
      } catch (err) {
        // Dismissing the sheet is a deliberate "no" — don't yank them to
        // instagram.com behind their back.
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    const didCopy = await copyToClipboard(caption);
    trackShare("instagram", didCopy ? "copy_open" : "open_only");
    setNote(
      didCopy
        ? "caption copied — paste it in your story or DM 📋"
        : "copy the roast, then paste it in your story or DM 📋"
    );
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    const didCopy = await copyToClipboard(url);
    // Reported after the attempt: a blocked clipboard write copies nothing, so
    // counting it as a share inflates the one metric the whole loop is judged
    // on (share_clicked / roast_delivered).
    trackShare("copy_link", didCopy ? "clipboard" : "clipboard_failed");
    if (didCopy) {
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
          className="bg-gradient-to-br from-fuchsia-200 to-orange-200 dark:from-fuchsia-900/50 dark:to-orange-900/40 -rotate-2 inline-flex items-center justify-center gap-2 min-h-11 border-2 border-foreground hover:-translate-y-1 hover:rotate-0 transition-all px-3.5 py-2 rounded-full text-sm font-bold shadow-[3px_3px_0_0_hsl(var(--brutal))]"
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
            onClick={() => trackShare(t.channel, "intent")}
            className={`${t.bg} ${i % 2 ? "-rotate-2" : "rotate-2"} inline-flex items-center justify-center gap-2 min-h-11 border-2 border-foreground hover:-translate-y-1 hover:rotate-0 transition-all px-3.5 py-2 rounded-full text-sm font-bold shadow-[3px_3px_0_0_hsl(var(--brutal))]`}
          >
            <span className="text-lg">{t.emoji}</span>
            {t.name}
          </a>
        ))}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center justify-center gap-2 min-h-11 bg-primary text-primary-foreground border-2 border-foreground hover:-translate-y-1 transition-all px-4 py-2 rounded-full text-sm font-black shadow-[3px_3px_0_0_hsl(var(--brutal))]"
        >
          {copied ? "✅ copied!" : "🔗 copy link"}
        </button>
      </div>
      {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
