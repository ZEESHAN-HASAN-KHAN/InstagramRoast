import { Helmet } from "react-helmet";
import { Leaderboard } from "./Leaderboard";
import { NearbyRoasts } from "./NearbyRoasts";

// Dedicated, linkable, indexable home for the boards. The homepage embeds the
// same sections as a teaser; this page is the shareable destination.
export function LeaderboardPage() {
  const pageUrl = "https://instaroasts.com/leaderboard";
  const description =
    "Today's most roasted and most savage Instagram profiles — see who got cooked hardest in the last 24 hours, worldwide and near you.";

  return (
    <>
      <Helmet>
        <title>Hall of Shame 🏆 — InstaRoasts Leaderboard</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content="Hall of Shame 🏆 — InstaRoasts Leaderboard" />
        <meta property="og:description" content={description} />
        <meta name="twitter:url" content={pageUrl} />
        <meta name="twitter:title" content="Hall of Shame 🏆 — InstaRoasts Leaderboard" />
        <meta name="twitter:description" content={description} />
      </Helmet>

      <Leaderboard standalone />
      <NearbyRoasts />
    </>
  );
}
