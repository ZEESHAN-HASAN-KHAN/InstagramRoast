import search from "../assets/search.png";
import searchw from "../assets/searchw.png";
import add from "../assets/add.png";

import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTheme } from "@/components/ui/theme-provider";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useNavigate } from "react-router-dom";
import { SelectDemo } from "./SelectDemo";

export function Compatiblity() {
  const { theme } = useTheme();
  const [uname1, setUname1] = useState("");
  const [uname2, setUname2] = useState("");
  const [language, setLanguage] = useState("english");
  const navigate = useNavigate();

  const handleValueChange = (value: string) => setLanguage(value);

  function discover(): void {
    navigate(
      `/compatiblityRoast?uname1=${uname1}&uname2=${uname2}&language=${language}`
    );
  }

  return (
    <div className="container flex flex-col justify-center items-center p-5 mt-10">
      <div className="flex flex-col justify-center items-center text-center w-full px-4">
        {/* Heading */}
        <h1
          style={{ fontFamily: "Sansita" }}
          className="text-3xl md:text-4xl lg:text-5xl text-gray-900 dark:text-gray-200 mt-4"
        >
          Check Compatiblity ❤️‍🔥
        </h1>
      </div>

      {/* Input Section */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (uname1 && uname2 && uname1 !== uname2) {
            discover();
          } else {
            alert(
              "Please fill in both usernames. Also, they should be different."
            );
          }
        }}
      >
        <div className="flex justify-center items-center w-full max-w-md gap-2 mt-6">
          <Input
            required
            className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm"
            placeholder="@username"
            onChange={(e) => setUname1(e.target.value.trim())}
            onKeyDown={(e) => e.key === "Enter" && discover()}
            value={uname1}
          />
          <img className="size-6" src={add} />
          <Input
            required
            className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm"
            placeholder="@username"
            onChange={(e) => setUname2(e.target.value.trim())}
            onKeyDown={(e) => e.key === "Enter" && discover()}
            value={uname2}
          />
          <RainbowButton type="submit" className="h-10 px-4 flex items-center">
            Compatiblity
            <img
              className="w-5 ml-1"
              src={theme === "dark" ? search : searchw}
              alt="Search Icon"
            />
          </RainbowButton>
        </div>
      </form>

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
  );
}
