// import instagram from "../assets/instagram.svg";
import Instagram from "../assets/Instagram.gif";
import search from "../assets/search.png";
import chatgpt from "../assets/chatgpt.png";
import searchw from "../assets/searchw.png";
import { Input } from "@/components/ui/input";
import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { AnimatedListDemo } from "./AnimatedListDemo";
import { AnimatedBeamDemo } from "./AnimatedBeamDemo";
import { useTheme } from "@/components/ui/theme-provider";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useNavigate } from "react-router-dom";
// import { NeonGradientCard } from "@/components/ui/neon-gradient-card";
export function Hero() {
  const { theme } = useTheme();
  const [uname, setUname] = useState("");
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

  return (
    <div className="flex flex-col lg:flex-row  ">
      {/* :Left Section */}
      <div className="lg:w-1/2 ml-5 mt-5 lg:mt-20 lg:ml-20">
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
      <div className="lg:w-1/2  mt-10 lg:mt-[5%] p-4 lg:justify-center ">
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
  );
}
