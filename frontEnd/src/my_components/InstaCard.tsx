import React from "react";

type InstaData = {
  profile_pic_url: string;
  username: string;
  full_name: string;
  post: number;
  follower: number;
  following: number;
  biography: string;
};

type InstaCardProps = {
  insta_data: InstaData;
};

function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

const InstaCard: React.FC<InstaCardProps> = ({ insta_data }) => {
  return (
    <div className="relative bg-card border-2 border-foreground rounded-3xl p-6 shadow-brutal w-full max-w-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Avatar with gradient ring */}
        <div className="relative">
          <div className="size-24 rounded-full p-1 bg-gradient-to-tr from-primary via-pink-400 to-accent">
            <img
              src={insta_data.profile_pic_url}
              alt={insta_data.username}
              className="size-full rounded-full object-cover bg-background"
            />
          </div>
          <span className="absolute -bottom-1 -right-1 text-2xl select-none">🔥</span>
        </div>

        <div className="text-center">
          <a
            href={`https://www.instagram.com/${insta_data.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-mono text-sm font-bold bg-yellow-200 dark:bg-yellow-900/40 px-2 py-0.5 rounded -rotate-1"
          >
            @{insta_data.username}
          </a>
          <div className="mt-2 font-serif text-xl font-bold italic">{insta_data.full_name}</div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-full px-3 py-1 text-sm">
            📸 <span className="font-bold">{formatCount(insta_data.post)}</span>
            <span className="text-muted-foreground text-xs">posts</span>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-full px-3 py-1 text-sm">
            👀 <span className="font-bold">{formatCount(insta_data.follower)}</span>
            <span className="text-muted-foreground text-xs">followers</span>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-full px-3 py-1 text-sm">
            🫶 <span className="font-bold">{formatCount(insta_data.following)}</span>
            <span className="text-muted-foreground text-xs">following</span>
          </span>
        </div>

        {insta_data.biography && (
          <p className="text-sm text-foreground/80 italic text-center">"{insta_data.biography}"</p>
        )}
      </div>
    </div>
  );
};

export default InstaCard;
