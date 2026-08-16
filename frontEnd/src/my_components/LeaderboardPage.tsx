import { Helmet } from "react-helmet";
import { Leaderboard } from "./Leaderboard";
import { NearbyRoasts } from "./NearbyRoasts";
import { CardOdds } from "./CardOdds";

// Dedicated, linkable, indexable home for the boards. The homepage embeds the
// same sections as a teaser; this page is the shareable destination.
export function LeaderboardPage() {
  const pageUrl = "https://instaroasts.com/leaderboard";
  // Crawlers never see these — server.js injects the real ones into the shell.
  // These keep the tab title and any in-app share correct after a client-side
  // navigation, and must stay in step with PAGE_META["/leaderboard"].
  const image = "https://instaroasts.com/og-leaderboard.png";
  const description =
    "The most roasted, most savage and rarest-card Instagram profiles — today's rolling 24h boards and the all-time hall of shame, worldwide and near you.";

  return (
    <>
      <Helmet>
        <title>Hall of Shame 🏆 — InstaRoasts Leaderboard</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content="Hall of Shame 🏆 — InstaRoasts Leaderboard" />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={image} />
        <meta property="og:image:alt" content="InstaRoasts leaderboard — who got cooked hardest today" />
        <meta name="twitter:image" content={image} />
        <meta name="twitter:url" content={pageUrl} />
        <meta name="twitter:title" content="Hall of Shame 🏆 — InstaRoasts Leaderboard" />
        <meta name="twitter:description" content={description} />
      </Helmet>

      <Leaderboard standalone />

      {/* Legend for the vault board above: the tier names in those rows mean
          nothing without the odds sitting next to them. Its own padded band on
          the page background — pulling it up under the board with a negative
          margin overlapped the board's last row. */}
      <section className="px-4 sm:px-6 pb-20 bg-background">
        <div className="w-full max-w-5xl mx-auto">
          <CardOdds title="🎴 the deck behind the vault" />
        </div>
      </section>

      <NearbyRoasts />
    </>
  );
}
