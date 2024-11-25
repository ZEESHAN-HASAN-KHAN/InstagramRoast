import { MarqueeDemo } from "./MarqueeDemo";

export function About() {
  return (
    <div className="mt-10">
      <span
        style={{ fontFamily: "Sansita" }}
        className="flex text-3xl lg:text-5xl p-4 lg:p-5  justify-center"
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
