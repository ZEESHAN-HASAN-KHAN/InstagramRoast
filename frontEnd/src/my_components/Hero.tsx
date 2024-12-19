// import Instagram from "../assets/Instagram.gif";
// import search from "../assets/search.png";

// import searchw from "../assets/searchw.png";
// import b1 from "../assets/b1.png";
// import b2 from "../assets/b2.png";
// import b4 from "../assets/b4.png";
// import b5 from "../assets/b5.png";
// import { Input } from "@/components/ui/input";
// import { useEffect, useState } from "react";

// import { useTheme } from "@/components/ui/theme-provider";
// import { RainbowButton } from "@/components/ui/rainbow-button";
// import { useNavigate } from "react-router-dom";
// import AnimatedGradientText from "@/components/ui/animated-gradient-text";
// import { ChartNoAxesCombined, ChevronRight } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { SelectDemo } from "./SelectDemo";

// export function Hero() {
//   const { theme } = useTheme();
//   const [uname, setUname] = useState("");
//   const [roastCount, setRoastCount] = useState(0);
//   const [language, setLanguage] = useState("english");
//   const handleValueChange = (value: string) => {
//     setLanguage(value);
//   };
//   const navigate = useNavigate();
//   async function discover() {
//     navigate(`/${uname}?language=${language}`);
//   }
//   const getRoastCount = async () => {
//     try {
//       const url = import.meta.env.VITE_APP_BASE_URL;

//       const result = await fetch(url + "/api/v1/roastCount");
//       const data = await result.json();
//       setRoastCount(data.count);
//     } catch (error) {
//       console.error("This is error", error);
//     }
//   };
//   useEffect(() => {
//     getRoastCount();
//   }, []);
//   return (
//     <div className="container">
//       <div className="flex flex-col items-center">
//         {/* Profile Roasted Count */}
// <div className="-z-10 mt-2">
//   <AnimatedGradientText>
//     <span
//       className={cn(
//         `inline animate-gradient bg-gradient-to-r from-[#ffaa40] via-[#9c40ff] to-[#ffaa40] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent text-sm`
//       )}
//     >
//       Profile Roasted 🔥 {roastCount}
//     </span>
//     <hr className="mx-2 h-4 w-px shrink-0 bg-gray-300" />
//     <ChartNoAxesCombined className="text-green-200" />
//     <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
//   </AnimatedGradientText>
// </div>

//         <div className="flex flex-col items-center   ">
//           {/* :Left Section */}
//           <div className="flex flex-col items-center">
//             <div className="flex flex-col items-center p-4">
//               <p
//                 style={{
//                   fontFamily: "Sansita",
//                 }}
//                 className="text-3xl lg:text-5xl text-gray-900 dark:text-gray-200  "
//               >
//                 Discover your
//               </p>

//               <div className="flex  flex-row  items-center gap-5 mb-4 ">
//                 <img src={Instagram} className=" w-10" />
//                 <p
//                   style={{
//                     fontFamily: "Sansita",
//                   }}
//                   className="text-3xl lg:text-5xl text-gray-900 dark:text-gray-200 "
//                 >
//                   Instagram Personality
//                 </p>
//               </div>
//             </div>
//             {/* Input Sectton */}
//             <div className="flex gap-1 px-4">
//               <Input
//                 className="z-20  inline w-[55%] lg:w-[40%] "
//                 placeholder="@username"
//                 onChange={(e) => {
//                   console.log(uname);
//                   setUname(e.target.value.trim());
//                 }}
//                 onKeyDown={(e) => {
//                   if (e.key === "Enter") {
//                     discover(); // Trigger the button's functionality
//                   }
//                 }}
//                 value={uname}
//               />

//               <RainbowButton
//                 onClick={discover}
//                 className="mb-2 z-10 h-9 w-auto "
//               >
//                 Discover{"   "}
//                 <img
//                   className="w-5 ml-1 "
//                   src={theme == "dark" ? search : searchw}
//                 ></img>
//               </RainbowButton>
//             </div>
//             {/* Agreement */}
//             <SelectDemo language={language} onValueChange={handleValueChange} />
//             <span
//               style={{
//                 fontFamily: "Roboto Slab",
//               }}
//               className="mt-5"
//             >
//               by clicking discover you agree to our terms
//             </span>
//             <a
//               className="mt-5"
//               href="https://www.producthunt.com/posts/instaroasts-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-instaroasts&#0045;2"
//               target="_blank"
//             >
//               <img
//                 src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=702163&theme=light"
//                 alt="InstaRoasts - Where&#0032;Humor&#0032;Meets&#0032;the&#0032;Heat&#0033;&#0032;🔥 | Product Hunt"
//                 // style="width: 250px; height: 54px;"
//                 width="250"
//                 height="54"
//               />
//             </a>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
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
import { cn } from "@/lib/utils";
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
      const result = await fetch(url + "/api/v1/roastCount");
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
        </div>
      </div>
    </div>
  );
}
