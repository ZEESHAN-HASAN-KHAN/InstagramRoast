import { MarqueeDemo } from "./MarqueeDemo";

export function About() {
  return (
    <div className="mt-10">
      <span
        style={{ fontFamily: "Sansita" }}
        className="flex text-3xl p-2 lg:text-4xl justify-center"
      >
        Popular & Trending Roasts
      </span>
      <span
        style={{ fontFamily: "Roboto" }}
        className="flex justify-center text-sm p-4"
      >
        Find out the most popular profiles that have been analyzed by our AI,
        click on them and see the full analysis!
      </span>
      <MarqueeDemo />
    </div>
  );
}
