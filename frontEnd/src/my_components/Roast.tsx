import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  const { userName } = useParams();
  const [userData, setUserdata] = useState({});
  const [roastData, setRoastdata] = useState("");
  const [recieve, setRecieve] = useState(false);
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

      const data = await result.json();
      // We need to parse the text
      const text = data.data;
      let parsedText = text
        .replace(/\\"/g, '"') // Replace escaped double quotes
        .replace(/\\n/g, "\n") // Replace escaped newlines
        .replace(/\\'/g, "'");
      setRoastdata(parsedText);
      setUserdata(data.insta_data);
      //   alert("Insta Data" + JSON.stringify(data.insta_data));
      // here we are getting the data
      // we are waiting extra 2 seconds

      setTimeout(() => {}, 2000);
      setRecieve(true);
      console.log(data);
    } catch (error) {
      console.error("Error:", error);
    }
  }
  useEffect(() => {
    // alert(userName);
    getData();
  }, []);
  return (
    <div>
      {recieve == true ? (
        <div>
          <div className="flex justify-center mt-5">
            <Card className="w-[440px] ">
              <CardHeader className="">
                <div className="flex flex-row gap-12 ">
                  <Avatar className="size-[90px]">
                    <AvatarImage
                      src="https://scontent-fra3-1.cdninstagram.com/v/t51.2885-19/453213006_522310623803084_735419205157180172_n.jpg?stp=dst-jpg_e0_s150x150_tt6&_nc_ht=scontent-fra3-1.cdninstagram.com&_nc_cat=108&_nc_ohc=qQ0CKaN_HsQQ7kNvgFucBpZ&_nc_gid=127bd53b418f43f5a1ab624d7cc60d65&edm=AEF8tYYBAAAA&ccb=7-5&oh=00_AYB_M2gnKStQhYvf2DkKdsG4mulo4pbqCacqzISEsd-J5g&oe=674BE6E6&_nc_sid=1e20d2"
                      alt="@shadcn"
                    />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-5 ">
                    <CardTitle>@{userData.userName}</CardTitle>
                    <CardTitle>
                      {" "}
                      <HyperText
                        className=" dark:text-white"
                        text={userData.name}
                      />
                    </CardTitle>
                  </div>
                </div>
                <div className="flex flex-row gap-3 justify-center">
                  <CardTitle>{userData.post} Posts</CardTitle>
                  <CardTitle>
                    <NumberTicker value={userData.follower} />
                    Followers
                  </CardTitle>
                  <CardTitle>
                    <NumberTicker value={userData.following} />
                    Following
                  </CardTitle>
                </div>
                <CardDescription>{userData.bio}</CardDescription>
              </CardHeader>
            </Card>
            {/* <Card className="w-fit flex justify-center"> Roast Data</Card> */}
          </div>
          <p
            className="flex justify-center text-md mt-5"
            style={{ fontFamily: "Sansita" }}
          >
            {" "}
            Here is the AI Agent Analysis of Your Personality
          </p>
          <div className="flex flex-row gap-1 justify-center mt-4">
            <span> Share:</span>
            <ul className="flex flex-row gap-2">
              <li className="flex flex-row gap-1 items-center">
                <img className="size-5" src={twitter} />
                <span>Twitter</span>
              </li>
              <li className="flex flex-row gap-1 items-center">
                <img className=" size-5" src={whatsapp} />
                <span>WhatsApp</span>
              </li>
              <li className="flex flex-row gap-1 items-center">
                <img className=" size-5" src={linkedin} />
                <span>LinkedIn</span>
              </li>
              <li className="flex  gap-1 items-center">
                <img className=" size-5" src={threads} />
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
        <div className="flex justify-center mt-5">
          <Skeleton className="w-[350px] flex flex-row items-center  ">
            <Skeleton className="w-12 h-12 rounded-full  m-5"></Skeleton>
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
