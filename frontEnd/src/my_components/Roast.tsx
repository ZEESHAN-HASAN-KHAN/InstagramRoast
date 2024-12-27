import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { HyperText } from "@/components/ui/hyper-text";
import NumberTicker from "@/components/ui/number-ticker";
import twitter from "../assets/twitter.png";
import whatsapp from "../assets/whatsapp.png";
import linkedin from "../assets/linkedin.png";
import threads from "../assets/threads.png";
import threads_w from "../assets/threads_w.png";

import { useTheme } from "@/components/ui/theme-provider";
import { createToken } from "@/lib/utils";

//Adding Confett
import type { ConfettiRef } from "@/components/ui/confetti";
import Confetti from "@/components/ui/confetti";

export function Roast() {
  const { theme } = useTheme();
  const confettiRef = useRef<ConfettiRef>(null);
  interface InstagramData {
    insta_data: {
      profile_pic_url: string;
      username: string;
      full_name: string;
      follower: number;
      following: number;
      biography: string;
      post: number;
    };
    data: string;
  }

  const { username } = useParams();
  const searchParams = new URLSearchParams(useLocation().search);
  const ln = searchParams.get("language") || "english";
  const [userData, setUserData] = useState<InstagramData | null>(null);
  const [roastData, setRoastData] = useState("");
  const [received, setReceived] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const shareLinks = {
    whatsapp:
      "https://api.whatsapp.com/send?text=Hey!%20Check%20out%20this%20AI%20roast%20I%20got%20from%20https%3A%2F%2Finstaroasts.com%2F" +
      username +
      "%3Flanguage%3D" +
      ln,
    linkedin:
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Finstaroasts.com%2F" +
      username +
      "%3Flanguage%3D" +
      ln,
    threads:
      "https://threads.net/intent/post?text=Hey!%20Check%20out%20this%20AI%20roast%20I%20got%20from%20https%3A%2F%2Finstaroasts.com%2F" +
      username +
      "%3Flanguage%3D" +
      ln,
    twitter:
      "https://x.com/intent/post?text=Hey!%21+Check+out+this+AI+roast+I+got+from+https%3A%2F%2Finstaroasts.com%2F" +
      username +
      "%3Flanguage%3D" +
      ln,
  };

  const getData = async () => {
    try {
      const url = import.meta.env.VITE_APP_BASE_URL;
      const token = await createToken();
      const result = await fetch(url + "/api/v1/roastMe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: username, language: ln }),
      });

      if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      const data: InstagramData = await result.json();
      const parsedText = data.data;

      setRoastData(parsedText);
      setUserData(data);

      setIsRunning(true);
      handleStartConfetti();
      setReceived(true);
      console.log(data);
    } catch (error) {
      console.error("Error:", error);
    }
  };
  const handleStartConfetti = () => {
    setTimeout(() => {
      setIsRunning(false);
    }, 5000);
  };

  useEffect(() => {
    // change the title of the page to the username
    if (username) {
      document.title = `Roast of ${username} 🔥`;
    }

    setUserData(null);
    setRoastData("");
    getData();
  }, [username]);

  const renderedMarkdown = useMemo(
    () => (
      <div className="prose break-all whitespace-normal font-medium dark:text-gray-200 text-gray-900">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{roastData}</ReactMarkdown>
      </div>
    ),
    [roastData]
  );

  return (
    <div>
      {received && userData ? (
        <div>
          {/* User Card */}
          <div className="flex justify-center mt-5">
            <Card className="w-[440px]">
              <CardHeader>
                <div className="flex flex-row gap-12">
                  <Avatar className="size-[90px]">
                    <AvatarImage
                      src={userData.insta_data.profile_pic_url}
                      alt={userData.insta_data.username}
                    />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-5">
                    <CardTitle>
                      <a
                        href={`https://www.instagram.com/${userData.insta_data.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none", color: "inherit" }} // Optional styling
                      >
                        @{userData.insta_data.username}
                      </a>
                    </CardTitle>

                    <CardTitle>
                      <HyperText
                        className="dark:text-white"
                        text={userData.insta_data.full_name}
                      />
                    </CardTitle>
                  </div>
                </div>
                <div className="flex flex-row gap-3 justify-center">
                  <CardTitle>
                    <NumberTicker value={userData.insta_data.post} /> Posts
                  </CardTitle>
                  <CardTitle>
                    <NumberTicker value={userData.insta_data.follower} />{" "}
                    Followers
                  </CardTitle>
                  <CardTitle>
                    <NumberTicker value={userData.insta_data.following} />{" "}
                    Following
                  </CardTitle>
                </div>
                <CardDescription>
                  {userData.insta_data.biography}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Roast Section */}
          <div className="px-4 md:px-8">
            <p className="flex justify-center text-sm md:text-xl mt-5 font-sansita text-center">
              Here is the AI Agent Analysis of Your Personality
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center mt-4">
              <span className="text-sm lg:text-xl">Share:</span>
              <ul className="flex flex-row flex-wrap gap-4 justify-center">
                <a
                  href={shareLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <li className="flex items-center gap-2">
                    <img
                      className="w-4 h-4 lg:w-8 lg:h-8"
                      src={twitter}
                      alt="Twitter"
                    />
                    <span className="text-sm lg:text-xl">Twitter</span>
                  </li>
                </a>
                <a
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <li className="flex items-center gap-2">
                    <img
                      className="w-4 h-4 lg:w-8 lg:h-8"
                      src={whatsapp}
                      alt="WhatsApp"
                    />
                    <span className="text-sm lg:text-xl">WhatsApp</span>
                  </li>
                </a>
                <a
                  href={shareLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <li className="flex items-center gap-2">
                    <img
                      className="w-4 h-4 lg:w-8 lg:h-8"
                      src={linkedin}
                      alt="LinkedIn"
                    />
                    <span className="text-sm lg:text-xl">LinkedIn</span>
                  </li>
                </a>
                <a
                  href={shareLinks.threads}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <li className="flex items-center gap-2">
                    <img
                      className="w-4 h-4 lg:w-8 lg:h-8"
                      src={theme === "dark" ? threads_w : threads}
                      alt="Threads"
                    />
                    <span className="text-sm lg:text-xl">Threads</span>
                  </li>
                </a>
              </ul>
            </div>
          </div>

          <div className="flex justify-center mt-10">
            <Card className="w-[550px]">
              <CardHeader>
                <CardDescription className="break-words whitespace-pre-wrap">
                  {renderedMarkdown}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          {isRunning && (
            <Confetti
              ref={confettiRef}
              className="absolute left-0 top-0 z-0 size-full"
            />
          )}
        </div>
      ) : (
        // Skeleton Loading
        <div className="flex justify-center mt-5">
          <Skeleton className="w-[380px] flex flex-row items-center">
            <Skeleton className="w-12 h-12 rounded-full m-5"></Skeleton>
            <div className="flex flex-col gap-5 ml-10">
              <Skeleton className="w-40 h-5"></Skeleton>
              <Skeleton className="w-25 h-5"></Skeleton>
            </div>
          </Skeleton>
        </div>
      )}
    </div>
  );
}
