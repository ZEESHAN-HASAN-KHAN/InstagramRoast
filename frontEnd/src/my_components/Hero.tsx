import Instagram from "../assets/Instagram.gif";
import search from "../assets/search.png";
import searchw from "../assets/searchw.png";
import b1 from "../assets/b1.png";
import b3 from "../assets/b3.png";
import b4 from "../assets/b4.png";
import b5 from "../assets/b5.png";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/ui/theme-provider";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useNavigate } from "react-router-dom";
import { SelectDemo } from "./SelectDemo";
import AnimatedGradientText from "@/components/ui/animated-gradient-text";
import { cn, createToken } from "@/lib/utils";
import { ChartNoAxesCombined, ChevronRight } from "lucide-react";

export function Hero() {
  const { theme } = useTheme();
  const [uname, setUname] = useState("");
  const [roastCount, setRoastCount] = useState(0);
  const [language, setLanguage] = useState("english");
  const navigate = useNavigate();

  const handleValueChange = (value: string) => setLanguage(value);

  const discover = async () => navigate(`/${uname}?language=${language}`);

  const getRoastCount = async () => {
    try {
      const url = import.meta.env.VITE_APP_BASE_URL;
      const token = await createToken();
      const result = await fetch(url + "/api/v1/roastCount", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await result.json();
      setRoastCount(data.count);
    } catch (error) {
      console.error("Error fetching roast count:", error);
    }
  };

  useEffect(() => {
    getRoastCount();
  }, []);

  return (
    <div className="flex justify-center items-center min-h-[40vh] px-4">
      {/* Centered Content Wrapper */}
      <div className="relative w-full max-w-4xl mx-auto flex items-center justify-center">
        {/* Floating Images */}
        <img
          src={b1}
          alt="Floating B1"
          className="absolute top-4 left-4 w-16 sm:w-20 lg:w-24 animate-pulse"
        />
        <img
          src={b3}
          alt="Floating B3"
          className="absolute top-4 right-4 w-16 sm:w-20 lg:w-24 animate-pulse"
        />
        <img
          src={b4}
          alt="Floating B4"
          className="absolute bottom-4 left-4 w-16 sm:w-20 lg:w-28 animate-pulse"
        />
        <img
          src={b5}
          alt="Floating B5"
          className="absolute bottom-4 right-4 w-16 sm:w-20 lg:w-28 animate-pulse"
        />

        {/* Center Content */}
        <div className="relative flex flex-col justify-center items-center text-center w-full px-4">
          {/* Profile Roasted Count */}
          <div className="-z-10 mt-2">
            <AnimatedGradientText>
              <span
                className={cn(
                  `inline animate-gradient bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent text-sm`
                )}
              >
                Profile Roasted 🔥 {roastCount}
              </span>
              <hr className="mx-2 h-4 w-px shrink-0 bg-gray-300" />
              <ChartNoAxesCombined className="text-green-200" />
              <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
            </AnimatedGradientText>
          </div>

          {/* Heading */}
          <h1
            style={{ fontFamily: "Sansita" }}
            className="text-3xl md:text-4xl lg:text-5xl text-gray-900 dark:text-gray-200 mt-4"
          >
            Discover your
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <img src={Instagram} alt="Instagram Icon" className="w-10" />
            <h2
              style={{ fontFamily: "Sansita" }}
              className="text-3xl md:text-4xl lg:text-5xl text-gray-900 dark:text-gray-200"
            >
              Instagram Personality
            </h2>
          </div>

          {/* Input Section */}
          <div className="flex w-full max-w-md gap-2 mt-6">
            <Input
              className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm"
              placeholder="@username"
              onChange={(e) => setUname(e.target.value.trim())}
              onKeyDown={(e) => e.key === "Enter" && discover()}
              value={uname}
            />
            <RainbowButton
              onClick={discover}
              className="h-10 px-4 flex items-center"
            >
              Discover
              <img
                className="w-5 ml-1"
                src={theme === "dark" ? search : searchw}
                alt="Search Icon"
              />
            </RainbowButton>
          </div>

          {/* Agreement */}
          <div className="mt-4">
            <SelectDemo language={language} onValueChange={handleValueChange} />
          </div>
          <span
            className="mt-2 text-xs md:text-sm text-gray-500"
            style={{ fontFamily: "Roboto Slab" }}
          >
            By clicking discover you agree to our terms
          </span>
          <a
            href="https://www.producthunt.com/posts/instaroasts-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-instaroasts&#0045;2"
            target="_blank"
          >
            <div className="mt-4 -z-30">
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=702163&theme=light"
                alt="InstaRoasts - Where&#0032;Humor&#0032;Meets&#0032;the&#0032;Heat&#0033;&#0032;🔥 | Product Hunt"
                style={{ width: "200px", height: "50px" }}
                width="250"
                height="54"
              />
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
