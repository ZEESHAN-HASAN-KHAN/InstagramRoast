import { ChartNoAxesCombined } from "lucide-react";
import { MarqueeDemo } from "./MarqueeDemo";

export function About() {
  return (
    <div className="mt-10">
      <span
        style={{ fontFamily: "Sansita" }}
        className="flex text-2xl lg:text-5xl p-4 lg:p-5  justify-center"
      >
        Popular & Trending Roasts
        <ChartNoAxesCombined className="text-green-300 ml-2 size-7" />
      </span>
      <span
        style={{ fontFamily: "Roboto" }}
        className="flex justify-center text-center text-sm p-4 "
      >
        Find out the most popular profiles that have been analyzed by our AI,
        click on them and see the full analysis!
      </span>
      <MarqueeDemo />
    </div>
  );
}
