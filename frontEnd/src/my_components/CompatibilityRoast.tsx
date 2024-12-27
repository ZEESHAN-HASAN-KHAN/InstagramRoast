import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import add from "../assets/add.png";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import remarkGfm from "remark-gfm";

import twitter from "../assets/twitter.png";
import whatsapp from "../assets/whatsapp.png";
import linkedin from "../assets/linkedin.png";
import threads from "../assets/threads.png";
import threads_w from "../assets/threads_w.png";

import { useTheme } from "@/components/ui/theme-provider";
import ReactMarkdown from "react-markdown";
import { createToken } from "@/lib/utils";
import InstaCard from "./InstaCard";
export function CompatiblityRoast() {
  interface userData {
    profile_pic_url: string;
    username: string;
    full_name: string;
    follower: number;
    following: number;
    biography: string;
    post: number;
    compatibilityText: string;
  }
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const uname1 = queryParams.get("uname1");
  const uname2 = queryParams.get("uname2");
  const language = queryParams.get("language");
  const [userData1, setUserData1] = useState<userData | null>(null);
  const [userData2, setUserData2] = useState<userData | null>(null);
  const [compatibilityRoast, setCompatibilityRoast] = useState("");
  const shareLinks = {
    whatsapp:
      "https://api.whatsapp.com/send?text=Hey!%20Check%20out%20this%20AI%20roast%20I%20got%20from%20https%3A%2F%2Finstaroasts.com%2FcompatibilityRoast%3Funame1%3D" +
      uname1 +
      "%26uname2%3D" +
      uname2 +
      "%26language%3D" +
      language,
    linkedin:
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Finstaroasts.com%2FcompatibilityRoast%3Funame1%3D" +
      uname1 +
      "%26uname2%3D" +
      uname2 +
      "%26language%3D" +
      language,
    threads:
      "https://threads.net/intent/post?text=Hey!%20Check%20out%20this%20AI%20roast%20I%20got%20from%20https%3A%2F%2Finstaroasts.com%2FcompatibilityRoast%3Funame1%3D" +
      uname1 +
      "%26uname2%3D" +
      uname2 +
      "%26language%3D" +
      language,
    twitter:
      "https://x.com/intent/post?text=Hey!%21+Check+out+this+AI+roast+I+got+from+https%3A%2F%2Finstaroasts.com%2FcompatibilityRoast%3Funame1%3D" +
      uname1 +
      "%26uname2%3D" +
      uname2 +
      "%26language%3D" +
      language,
  };
  const { theme } = useTheme();

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
    const token = await createToken();
    const result = await fetch(url + "/api/v1/compatibilityRoast", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uname1: uname1,
        uname2: uname2,
        language: language,
      }),
    });
    const data = await result.json();
    setCompatibilityRoast(data.compatibilityText);
    setUserData1(data.userData1);
    setUserData2(data.userData2);
  };
  useEffect(() => {
    if (uname1 === null || uname2 === null || language === null) {
      navigate("/");
    }
    fetchData();
  }, []);

  return (
    <div>
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
          {/* User Card */}

          <div className="flex flex-col lg:flex-row justify-center sm:items-center gap-5">
          <div className="flex justify-center mt-5">
            {userData1 !== null && <InstaCard insta_data={userData1} />}
          </div>

          <div className="flex justify-center mt-5">
            <img className="size-8 animate-pulse" src={add} />
          </div>

          <div className="flex justify-center mt-5">
            {userData2 !== null && <InstaCard insta_data={userData2} />}
          </div>
          </div>
          

          {/* Roast Section */}
          <div className="px-4 md:px-8">
            <p className="flex justify-center text-sm md:text-xl mt-5 font-sansita text-center">
              Your Compatibility Roast Results Are In! 🎭
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
      )}
    </div>
  );
}
