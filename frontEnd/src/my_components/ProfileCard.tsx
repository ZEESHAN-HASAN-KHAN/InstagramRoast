export type ProfileData = {
  handle: string;
  displayName: string;
  avatarUrl: string;
  posts: number;
  followers: number;
  following: number;
  bio: string;
};

function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function ProfileCard({ profile }: { profile: ProfileData }) {
  return (
    <div className="relative bg-card border-2 border-foreground rounded-3xl p-6 md:p-8 shadow-brutal rotate-[0.5deg]">
      <div className="absolute -top-3 -right-3 bg-accent text-accent-foreground text-xs font-black uppercase px-3 py-1.5 rounded-full rotate-[8deg] shadow-md">
        🎯 target locked
      </div>
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="relative shrink-0">
          <div className="size-28 md:size-32 rounded-full p-1 bg-gradient-to-tr from-primary via-pink-400 to-accent">
            <img
              src={profile.avatarUrl}
              alt={`${profile.displayName} avatar`}
              className="size-full rounded-full object-cover bg-background"
            />
          </div>
          <span className="absolute -bottom-2 -right-2 text-3xl rotate-12 select-none">🔥</span>
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <a
            href={`https://www.instagram.com/${profile.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-mono text-base font-bold break-all bg-yellow-200 dark:bg-yellow-900/40 px-2 py-0.5 rounded -rotate-1 hover:rotate-0 transition-transform"
          >
            @{profile.handle}
          </a>
          <div className="mt-2 font-serif text-2xl md:text-3xl font-bold italic">
            {profile.displayName}
          </div>
          <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2">
            <Stat emoji="📸" label="posts" value={formatCount(profile.posts)} />
            <Stat emoji="👀" label="followers" value={formatCount(profile.followers)} />
            <Stat emoji="🫶" label="following" value={formatCount(profile.following)} />
          </div>
          {profile.bio && (
            <p className="mt-4 text-sm text-foreground/80 italic">"{profile.bio}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-full px-3 py-1 text-sm">
      <span>{emoji}</span>
      <span className="font-bold">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
