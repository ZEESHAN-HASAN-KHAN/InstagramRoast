import { Helmet } from "react-helmet";
import { Leaderboard } from "./Leaderboard";
import { NearbyRoasts } from "./NearbyRoasts";

// Dedicated, linkable, indexable home for the boards. The homepage embeds the
// same sections as a teaser; this page is the shareable destination.
export function LeaderboardPage() {
  const pageUrl = "https://instaroasts.com/leaderboard";
  // Crawlers never see these — server.js injects the real ones into the shell.
  // These keep the tab title and any in-app share correct after a client-side
  // navigation, and must stay in step with PAGE_META["/leaderboard"].
  const image = "https://instaroasts.com/og-leaderboard.png";
  const description =
    "The most roasted and most savage Instagram profiles — today's rolling 24h board and the all-time hall of shame, worldwide and near you.";

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
      <NearbyRoasts />
    </>
  );
}
