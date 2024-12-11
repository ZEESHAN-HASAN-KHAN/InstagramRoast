// import instagram from "../assets/instagram.svg";
import Instagram from "../assets/Instagram.gif";
import search from "../assets/search.png";
import chatgpt from "../assets/chatgpt.png";
import searchw from "../assets/searchw.png";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
// import { Button } from "@/components/ui/button";
// import { AnimatedListDemo } from "./AnimatedListDemo";
import { AnimatedBeamDemo } from "./AnimatedBeamDemo";
import { useTheme } from "@/components/ui/theme-provider";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useNavigate } from "react-router-dom";
import AnimatedGradientText from "@/components/ui/animated-gradient-text";
import { ChartNoAxesCombined, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
// import { NeonGradientCard } from "@/components/ui/neon-gradient-card";
export function Hero() {
  const { theme } = useTheme();
  const [uname, setUname] = useState("");
  const [roastCount, setRoastCount] = useState(0);
  const navigate = useNavigate();
  async function discover() {
    // send this data to backend
    // if we get the data we'll redirect it to
    // other page
    //if username doesnot't exist or failed to fetch
    // we'll show the toast notification

    navigate("/" + uname);
    // setUname("");
  }
  const getRoastCount = async () => {
    try {
      const url = import.meta.env.VITE_APP_BASE_URL;

      const result = await fetch(url + "/api/v1/roastCount");
      const data = await result.json();
      setRoastCount(data.count);
    } catch (error) {
      console.error("This is error");
    }
  };
  useEffect(() => {
    getRoastCount();
  }, []);
  return (
    <div>
      <div className=" mt-2">
        <AnimatedGradientText>
          🔥
          <span
            className={cn(
              `inline animate-gradient bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent text-sm`
            )}
          >
            Profile Roasted {roastCount}
          </span>
          <hr className="mx-2 h-4 w-px shrink-0 bg-gray-300" />
          <ChartNoAxesCombined className="text-green-200" />
          <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
        </AnimatedGradientText>
      </div>
      <div className="flex flex-col lg:flex-row  ">
        {/* :Left Section */}
        <div className="lg:w-1/2 ml-5 mt-5 lg:ml-20 lg:mt-10">
          <div>
            <p
              style={{
                fontFamily: "Sansita",
              }}
              className="text-4xl text-gray-900 dark:text-gray-200  "
            >
              Discover your
            </p>

            <div className="flex  flex-row  items-center gap-5 mb-4 ">
              <img src={Instagram} className=" w-[9%]" />
              <p
                style={{
                  fontFamily: "Sansita",
                }}
                className="text-4xl text-gray-900 dark:text-gray-200 "
              >
                Instagram Personality
              </p>
            </div>
          </div>
          {/* Input Sectton */}
          <div className="flex gap-1">
            <Input
              className="z-20  inline w-[55%] lg:w-[40%] "
              placeholder="@username"
              onChange={(e) => {
                console.log(uname);
                setUname(e.target.value);
              }}
              value={uname}
            />

            <RainbowButton onClick={discover} className="mb-2 z-10 h-9 w-auto ">
              Discover{"   "}
              <img
                className="w-5 ml-1 "
                src={theme == "dark" ? search : searchw}
              ></img>
            </RainbowButton>
          </div>
          {/* Agreement */}
          <span
            style={{
              fontFamily: "Roboto Slab",
            }}
            className=""
          >
            by clicking discover you agree to our terms
          </span>
        </div>
        {/* Right Section */}
        <div className="lg:w-1/2  mt-10 lg:mt-[3%] p-4 lg:justify-center ">
          <AnimatedBeamDemo></AnimatedBeamDemo>

          <div
            style={{
              fontFamily: "Sansita",
            }}
            className=" flex mt-10 items-center lg:mt-20 "
          >
            <span className="text-4xl text-red-400"> Powered By </span>
            <img className="inline w-14" src={chatgpt}></img>
            <span className="text-4xl">OpenAI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
