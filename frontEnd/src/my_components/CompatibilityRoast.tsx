import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createToken } from "@/lib/utils";
import InstaCard from "./InstaCard";

export function CompatiblityRoast() {
  interface UserData {
    profile_pic_url: string;
    username: string;
    full_name: string;
    follower: number;
    following: number;
    biography: string;
    post: number;
    compatibilityText: string;
  }

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const uname1 = queryParams.get("uname1");
  const uname2 = queryParams.get("uname2");
  const language = queryParams.get("language");

  const [userData1, setUserData1] = useState<UserData | null>(null);
  const [userData2, setUserData2] = useState<UserData | null>(null);
  const [compatibilityRoast, setCompatibilityRoast] = useState("");
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";

  const shareLinks = {
    whatsapp:
      "https://api.whatsapp.com/send?text=Hey!%20Check%20out%20this%20AI%20roast%20I%20got%20from%20https%3A%2F%2Finstaroasts.com%2FcompatibilityRoast%3Funame1%3D" +
      uname1 + "%26uname2%3D" + uname2 + "%26language%3D" + language,
    linkedin:
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Finstaroasts.com%2FcompatibilityRoast%3Funame1%3D" +
      uname1 + "%26uname2%3D" + uname2 + "%26language%3D" + language,
    threads:
      "https://threads.net/intent/post?text=Hey!%20Check%20out%20this%20AI%20roast%20I%20got%20from%20https%3A%2F%2Finstaroasts.com%2FcompatibilityRoast%3Funame1%3D" +
      uname1 + "%26uname2%3D" + uname2 + "%26language%3D" + language,
    twitter:
      "https://x.com/intent/post?text=Hey!%21+Check+out+this+AI+roast+I+got+from+https%3A%2F%2Finstaroasts.com%2FcompatibilityRoast%3Funame1%3D" +
      uname1 + "%26uname2%3D" + uname2 + "%26language%3D" + language,
  };

  const renderedMarkdown = useMemo(
    () => (
      <div className="prose break-words whitespace-normal font-serif text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{compatibilityRoast}</ReactMarkdown>
      </div>
    ),
    [compatibilityRoast]
  );

  const fetchData = async () => {
    const apiUrl = import.meta.env.VITE_APP_BASE_URL;
    const token = await createToken();
    const result = await fetch(apiUrl + "/api/v1/compatibilityRoast", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uname1, uname2, language }),
    });
    const data = await result.json();
    setCompatibilityRoast(data.compatibilityText);
    setUserData1(data.userData1);
    setUserData2(data.userData2);
  };

  useEffect(() => {
    if (uname1 === null || uname2 === null || language === null) {
      navigate("/");
    }
    fetchData();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  const shareTargets = [
    { name: "Tweet it", href: shareLinks.twitter, emoji: "🐦", bg: "bg-sky-200 dark:bg-sky-900/40" },
    { name: "WhatsApp", href: shareLinks.whatsapp, emoji: "💬", bg: "bg-green-200 dark:bg-green-900/40" },
    { name: "LinkedIn", href: shareLinks.linkedin, emoji: "💼", bg: "bg-blue-200 dark:bg-blue-900/40" },
    { name: "Threads", href: shareLinks.threads, emoji: "🧵", bg: "bg-purple-200 dark:bg-purple-900/40" },
  ];

  if (compatibilityRoast === "") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row justify-center items-center gap-8">
          {/* Skeleton card 1 */}
          <div className="bg-card border-2 border-foreground rounded-3xl p-6 shadow-brutal w-full max-w-sm animate-pulse">
            <div className="flex flex-col items-center gap-4">
              <div className="size-24 rounded-full bg-muted border-2 border-foreground" />
              <div className="h-5 bg-muted rounded-xl w-32" />
              <div className="h-7 bg-muted rounded-xl w-44" />
              <div className="flex gap-2">
                <div className="h-7 bg-muted rounded-full w-20" />
                <div className="h-7 bg-muted rounded-full w-24" />
              </div>
            </div>
          </div>

          <div className="shrink-0 size-12 bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground rounded-full flex items-center justify-center font-black text-sm shadow-brutal">
            VS
          </div>

          {/* Skeleton card 2 */}
          <div className="bg-card border-2 border-foreground rounded-3xl p-6 shadow-brutal w-full max-w-sm animate-pulse">
            <div className="flex flex-col items-center gap-4">
              <div className="size-24 rounded-full bg-muted border-2 border-foreground" />
              <div className="h-5 bg-muted rounded-xl w-32" />
              <div className="h-7 bg-muted rounded-xl w-44" />
              <div className="flex gap-2">
                <div className="h-7 bg-muted rounded-full w-20" />
                <div className="h-7 bg-muted rounded-full w-24" />
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground italic mt-8">
          ⏳ analysing compatibility… this takes ~10-20 seconds
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
      {/* Profile cards */}
      <div className="flex flex-col lg:flex-row justify-center items-center gap-8">
        {userData1 && <InstaCard insta_data={userData1} />}
        <div className="shrink-0 size-12 bg-pink-200 dark:bg-pink-900/40 border-2 border-foreground rounded-full flex items-center justify-center font-black text-sm shadow-brutal">
          VS
        </div>
        {userData2 && <InstaCard insta_data={userData2} />}
      </div>

      {/* Share bar */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="font-serif italic text-base">share the burn →</span>
        {shareTargets.map((t, i) => (
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

      {/* Compatibility roast card */}
      <div className="relative">
        <div className="absolute -top-6 -left-3 text-4xl rotate-[-18deg] animate-float pointer-events-none select-none">❤️‍🔥</div>
        <div className="absolute -top-8 right-4 text-5xl rotate-[14deg] animate-float [animation-delay:1s] pointer-events-none select-none">💀</div>

        <article className="relative bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 dark:from-pink-900/30 dark:via-rose-900/30 dark:to-orange-900/30 border-2 border-foreground rounded-3xl p-8 md:p-10 shadow-brutal rotate-[-0.6deg]">
          <div className="absolute -top-4 left-6 bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full rotate-[-4deg] shadow-md">
            🎭 compatibility verdict
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
            <span className="font-bold">— your AI matchmaker 😈</span>
            <span className="text-2xl">✨❤️‍🔥✨</span>
          </div>
        </article>
      </div>
    </div>
  );
}
