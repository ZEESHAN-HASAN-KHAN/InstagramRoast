import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  //   CardContent,
  CardDescription,
  //   CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import HyperText from "@/components/ui/hyper-text";
import NumberTicker from "@/components/ui/number-ticker";

import twitter from "../assets/twitter.png";
import whatsapp from "../assets/whatsapp.png";
import linkedin from "../assets/linkedin.png";
import threads from "../assets/threads.png";

export function Roast() {
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

  const { userName } = useParams();
  const [userData, setUserData] = useState<InstagramData | null>(null);
  const [roastData, setRoastData] = useState("");
  const [received, setReceived] = useState(false);

  async function getData() {
    try {
      const result = await fetch("http://localhost:3000/api/v1/roastMe", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: userName }),
      });

      if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      const data: InstagramData = await result.json();

      const parsedText = data.data
        .replace(/\\"/g, '"') // Replace escaped double quotes
        .replace(/\\n/g, "\n") // Replace escaped newlines
        .replace(/\\'/g, "'");

      setRoastData(parsedText);
      setUserData(data);
      setReceived(true);
      console.log(data);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  useEffect(() => {
    getData();
  }, []);

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
                    <CardTitle>@{userData.insta_data.username}</CardTitle>
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
                    <NumberTicker value={userData.insta_data.follower} />
                    Followers
                  </CardTitle>
                  <CardTitle>
                    <NumberTicker value={userData.insta_data.following} />
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
          <p className="flex justify-center text-md mt-5 font-sansita">
            Here is the AI Agent Analysis of Your Personality
          </p>
          <div className="flex flex-row gap-1 justify-center mt-4">
            <span>Share:</span>
            <ul className="flex flex-row gap-2">
              <li className="flex flex-row gap-1 items-center">
                <img className="size-5" src={twitter} alt="Twitter" />
                <span>Twitter</span>
              </li>
              <li className="flex flex-row gap-1 items-center">
                <img className="size-5" src={whatsapp} alt="WhatsApp" />
                <span>WhatsApp</span>
              </li>
              <li className="flex flex-row gap-1 items-center">
                <img className="size-5" src={linkedin} alt="LinkedIn" />
                <span>LinkedIn</span>
              </li>
              <li className="flex gap-1 items-center">
                <img className="size-5" src={threads} alt="Threads" />
                <span>Threads</span>
              </li>
            </ul>
          </div>
          <div className="flex justify-center mt-10">
            <Card className="w-[550px]">
              <CardHeader>
                <CardDescription>{roastData}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      ) : (
        // Skeleton Loading
        <div className="flex justify-center mt-5">
          <Skeleton className="w-[350px] flex flex-row items-center">
            <Skeleton className="w-12 h-12 rounded-full m-5"></Skeleton>
            <div className="flex flex-col gap-5 ml-10">
              <Skeleton className="w-20 h-5"></Skeleton>
              <Skeleton className="w-20 h-5"></Skeleton>
            </div>
          </Skeleton>
        </div>
      )}
    </div>
  );
}
