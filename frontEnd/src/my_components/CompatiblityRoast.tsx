import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import add from "../assets/add.png";
export function CompatiblityRoast() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const uname = queryParams.get("uname");
  const uname1 = queryParams.get("uname1");
  useEffect(() => {
    // logic to fetch data from Database
    //create combine Data and get the result from AI
    //store this Roast  data to another table
  }, []);
  return (
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
  );
}
