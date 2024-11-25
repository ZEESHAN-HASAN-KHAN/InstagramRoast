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
      setUserdata(data);
      // here we are getting the data
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
            <Card className="w-fit ">
              <CardHeader className="">
                <div className="flex flex-row justify-between ">
                  <Avatar className="size-[90px]">
                    <AvatarImage
                      src="https://github.com/shadcn.png"
                      alt="@shadcn"
                    />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-5 ">
                    <CardTitle>@iam_zhk</CardTitle>
                    <CardTitle>
                      {" "}
                      <HyperText
                        className=" dark:text-white"
                        text="Zeeshan Hasan Khan"
                      />
                    </CardTitle>
                  </div>
                </div>
                <div className="flex flex-row gap-3 justify-center">
                  <CardTitle>0 Posts</CardTitle>
                  <CardTitle>
                    <NumberTicker value={1000} />
                    Followers
                  </CardTitle>
                  <CardTitle>79 Following</CardTitle>
                </div>
                <CardDescription>
                  Software Engineer Ready to change the world
                </CardDescription>
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
          <Card>
            <CardHeader>
              <CardDescription>{JSON.stringify(userData)}</CardDescription>
            </CardHeader>
          </Card>
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
