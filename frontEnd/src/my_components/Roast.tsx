import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { createToken } from "@/lib/utils";
import type { ConfettiRef } from "@/components/ui/confetti";
import Confetti from "@/components/ui/confetti";
import { ProfileCard } from "./ProfileCard";
import { RoastCard } from "./RoastCard";
import { ShareBar } from "./ShareBar";

interface InstagramData {
  insta_data: {
    profile_pic_url: string;
    username: string;
    full_name: string;
    follower: number;
    following: number;
    biography: string;
    post: number;
  };
  data: string;
}

export function Roast() {
  const confettiRef = useRef<ConfettiRef>(null);

  const { username } = useParams();
  const searchParams = new URLSearchParams(useLocation().search);
  const ln = searchParams.get("language") || "english";
  const [userData, setUserData] = useState<InstagramData | null>(null);
  const [roastData, setRoastData] = useState("");
  const [received, setReceived] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const getData = async () => {
    try {
      const apiUrl = import.meta.env.VITE_APP_BASE_URL;
      const token = await createToken();
      const result = await fetch(apiUrl + "/api/v1/roastMe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: username, language: ln }),
      });
      if (!result.ok) throw new Error(`HTTP error! status: ${result.status}`);
      const data: InstagramData = await result.json();
      setRoastData(data.data);
      setUserData(data);
      setIsRunning(true);
      setTimeout(() => setIsRunning(false), 5000);
      setReceived(true);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  useEffect(() => {
    if (username) document.title = `Roast of ${username} 🔥`;
    setUserData(null);
    setRoastData("");
    setReceived(false);
    getData();
  }, [username]);

  if (!received) {
    return (
      <div className="relative overflow-hidden px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Profile skeleton */}
          <div className="bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal animate-pulse">
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <div className="size-28 rounded-full bg-muted border-2 border-foreground shrink-0" />
              <div className="flex-1 w-full space-y-3">
                <div className="h-6 bg-muted rounded-xl w-40" />
                <div className="h-8 bg-muted rounded-xl w-56" />
                <div className="flex gap-2 mt-4">
                  <div className="h-8 bg-muted rounded-full w-20" />
                  <div className="h-8 bg-muted rounded-full w-24" />
                  <div className="h-8 bg-muted rounded-full w-22" />
                </div>
                <div className="h-4 bg-muted rounded w-full" />
              </div>
            </div>
          </div>
          {/* Roast card skeleton */}
          <div className="bg-card border-2 border-foreground rounded-3xl p-8 shadow-brutal animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded-xl w-32" />
            <div className="h-5 bg-muted rounded w-full" />
            <div className="h-5 bg-muted rounded w-[95%]" />
            <div className="h-5 bg-muted rounded w-[88%]" />
            <div className="h-5 bg-muted rounded w-full" />
            <div className="h-5 bg-muted rounded w-[75%]" />
          </div>
          <p className="text-center text-sm text-muted-foreground italic">
            ⏳ crafting your roast… this takes ~10-20 seconds
          </p>
        </div>
      </div>
    );
  }

  if (!userData) return null;

  const { insta_data } = userData;
  const profile = {
    handle: insta_data.username,
    displayName: insta_data.full_name,
    avatarUrl: insta_data.profile_pic_url,
    posts: insta_data.post,
    followers: insta_data.follower,
    following: insta_data.following,
    bio: insta_data.biography,
  };
  const shareTitle = `Here is the roast for ${insta_data.full_name} @${insta_data.username} 🔥`;

  return (
    <div className="relative overflow-hidden px-6 py-12">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-20 size-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-72 rounded-full bg-yellow-300/20 blur-3xl" />

      <div className="max-w-3xl mx-auto space-y-10">
        {/* Back button */}
        <div className="animate-reveal flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-card border-2 border-foreground rounded-full px-4 py-2 text-sm font-bold hover:-translate-y-0.5 hover:rotate-[-2deg] transition-all shadow-[3px_3px_0_0_hsl(0_0%_8%)]"
          >
            ← roast someone else
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold bg-yellow-200 dark:bg-yellow-900/40 border-2 border-foreground rounded-full px-3 py-1 rotate-2">
            🍿 grab popcorn
          </span>
        </div>

        {/* Heading */}
        <div className="animate-reveal [animation-delay:100ms] text-center space-y-4">
          <div className="inline-block bg-foreground text-background px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest rotate-[-2deg]">
            🚨 roast incoming
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold italic text-balance leading-[1.05]">
            we cooked{" "}
            <span className="text-primary underline decoration-wavy decoration-accent underline-offset-4">
              @{insta_data.username}
            </span>{" "}
            🍳🔥
          </h1>
          <p className="text-muted-foreground text-base">brace yourself — no feelings were spared.</p>
        </div>

        {/* Profile Card */}
        <div className="animate-reveal [animation-delay:200ms]">
          <ProfileCard profile={profile} />
        </div>

        {/* Roast Card */}
        <div className="animate-reveal [animation-delay:300ms] pt-4">
          <RoastCard roast={roastData} />
        </div>

        {/* Share */}
        <div className="animate-reveal [animation-delay:400ms] space-y-4 text-center">
          <p className="font-serif italic text-lg">too good not to share 👇</p>
          <ShareBar title={shareTitle} text={roastData} />
        </div>
      </div>

      {isRunning && (
        <Confetti
          ref={confettiRef}
          className="absolute left-0 top-0 z-0 size-full"
        />
      )}
    </div>
  );
}
