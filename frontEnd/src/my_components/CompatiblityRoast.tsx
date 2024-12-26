import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import add from "../assets/add.png";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HyperText } from "@/components/ui/hyper-text";
import NumberTicker from "@/components/ui/number-ticker";
import remarkGfm from "remark-gfm";

import twitter from "../assets/twitter.png";
import whatsapp from "../assets/whatsapp.png";
import linkedin from "../assets/linkedin.png";
import threads from "../assets/threads.png";
import threads_w from "../assets/threads_w.png";

import { useTheme } from "@/components/ui/theme-provider";
import ReactMarkdown from "react-markdown";
// import { createToken } from "@/lib/utils";
export function CompatiblityRoast() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const uname1 = queryParams.get("uname1");
  const uname2 = queryParams.get("uname2");
  const [userData1, setUserData1] = useState(null);
  const [userData2, setUserData2] = useState(null);
  const [compatibilityRoast, setCompatibilityRoast] = useState("");
  const shareLinks = {
    whatsapp:
      "https://api.whatsapp.com/send?text=Hey!%20Check%20out%20this%20AI%20roast%20I%20got%20from%20https%3A%2F%2Finstaroasts.com%2FcompatiblityRoast%3Funame1%3D" +
      uname1 +
      "%26uname2%3D" +
      uname2,
    linkedin:
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Finstaroasts.com%2FcompatiblityRoast%3Funame1%3D" +
      uname1 +
      "%26uname2%3D" +
      uname2,
    threads:
      "https://threads.net/intent/post?text=Hey!%20Check%20out%20this%20AI%20roast%20I%20got%20from%20https%3A%2F%2Finstaroasts.com%2FcompatiblityRoast%3Funame1%3D" +
      uname1 +
      "%26uname2%3D" +
      uname2,
    twitter:
      "https://x.com/intent/post?text=Hey!%21+Check+out+this+AI+roast+I+got+from+https%3A%2F%2Finstaroasts.com%2FcompatiblityRoast%3Funame1%3D" +
      uname1 +
      "%26uname2%3D" +
      uname2,
  };
  const theme = useTheme();

  const renderedMarkdown = useMemo(
    () => (
      <div className="prose break-all whitespace-normal font-medium dark:text-gray-200 text-gray-900">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {compatibilityRoast}
        </ReactMarkdown>
      </div>
    ),
    [compatibilityRoast]
  );
  const fetchData = async () => {
    const url = import.meta.env.VITE_APP_BASE_URL;
    // const token = await createToken();
    const result = await fetch(url + "/api/v1/compatibilityRoast", {
      method: "POST",
      headers: {
        // Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uname1: uname1,
        uname2: uname2,
        language: "english",
      }),
    });
    const data = await result.json();
    setCompatibilityRoast(data.compatibilityText);
    setUserData1(data.userData1);
    setUserData2(data.userData2);
  };
  useEffect(() => {
    fetchData();
  }, []);
  return (
    <>
      {compatibilityRoast == "" ? (
        <div className="container">
          <div className=" flex flex-col lg:flex lg:flex-row justify-center items-center mt-5 gap-5">
            <Skeleton className="w-[380px] flex flex-row items-center">
              <Skeleton className="w-12 h-12 rounded-full m-5"></Skeleton>
              <div className="flex flex-col gap-5 ml-10">
                <Skeleton className="w-40 h-5"></Skeleton>
                <Skeleton className="w-25 h-5"></Skeleton>
              </div>
            </Skeleton>
            <img className="size-8 animate-pulse" src={add} />
            <Skeleton className="w-[380px] flex flex-row items-center">
              <Skeleton className="w-12 h-12 rounded-full m-5"></Skeleton>
              <div className="flex flex-col gap-5 ml-10">
                <Skeleton className="w-40 h-5"></Skeleton>
                <Skeleton className="w-25 h-5"></Skeleton>
              </div>
            </Skeleton>
          </div>
        </div>
      ) : (
        <div>
          {" "}
          <div>
            {/* User Card */}
            <div className="flex flex-col lg:flex-row  justify-center  items-center gap-5 mt-5">
              <Card className="w-[440px]">
                <CardHeader>
                  <div className="flex flex-row gap-12">
                    <Avatar className="size-[90px]">
                      <AvatarImage
                        src={userData1.profile_pic_url}
                        alt={userData1.username}
                      />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-5">
                      <CardTitle>
                        <a
                          href={`https://www.instagram.com/${userData1.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "none", color: "inherit" }} // Optional styling
                        >
                          @{userData1.username}
                        </a>
                      </CardTitle>

                      <CardTitle>
                        <HyperText
                          className="dark:text-white"
                          text={userData1.full_name}
                        />
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex flex-row gap-3 justify-center">
                    <CardTitle>
                      <NumberTicker value={userData1.post} /> Posts
                    </CardTitle>
                    <CardTitle>
                      <NumberTicker value={userData1.follower} /> Followers
                    </CardTitle>
                    <CardTitle>
                      <NumberTicker value={userData1.following} /> Following
                    </CardTitle>
                  </div>
                  <CardDescription>{userData1.biography}</CardDescription>
                </CardHeader>
              </Card>
              <img className="size-8 animate-pulse" src={add} />
              <Card className="w-[440px]">
                <CardHeader>
                  <div className="flex flex-row gap-12">
                    <Avatar className="size-[90px]">
                      <AvatarImage
                        src={userData2.profile_pic_url}
                        alt={userData2.username}
                      />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-5">
                      <CardTitle>
                        <a
                          href={`https://www.instagram.com/${userData1.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "none", color: "inherit" }} // Optional styling
                        >
                          @{userData2.username}
                        </a>
                      </CardTitle>

                      <CardTitle>
                        <HyperText
                          className="dark:text-white"
                          text={userData2.full_name}
                        />
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex flex-row gap-3 justify-center">
                    <CardTitle>
                      <NumberTicker value={userData2.post} /> Posts
                    </CardTitle>
                    <CardTitle>
                      <NumberTicker value={userData2.follower} /> Followers
                    </CardTitle>
                    <CardTitle>
                      <NumberTicker value={userData2.following} /> Following
                    </CardTitle>
                  </div>
                  <CardDescription>{userData2.biography}</CardDescription>
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
                    {/* {compatibilityRoast} */}
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
