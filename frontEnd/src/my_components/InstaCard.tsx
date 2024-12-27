import React from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HyperText } from "@/components/ui/hyper-text";
import NumberTicker from "@/components/ui/number-ticker";

type InstaData = {
  profile_pic_url: string;
  username: string;
  full_name: string;
  post: number;
  follower: number;
  following: number;
  biography: string;
};

type InstaCardProps = {
  insta_data: InstaData;
};

const InstaCard: React.FC<InstaCardProps> = ({ insta_data }) => {
  return (
    <Card className="w-[440px]">
      <CardHeader>
        <div className="flex flex-row gap-12">
          <Avatar className="size-[90px]">
            <AvatarImage
              src={insta_data.profile_pic_url}
              alt={insta_data.username}
            />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-5">
            <CardTitle>
              <a
                href={`https://www.instagram.com/${insta_data.username}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                @{insta_data.username}
              </a>
            </CardTitle>

            <CardTitle>
              <HyperText
                className="dark:text-white"
                text={insta_data.full_name}
              />
            </CardTitle>
          </div>
        </div>
        <div className="flex flex-row gap-3 justify-center">
          <CardTitle>
            <NumberTicker value={insta_data.post} /> Posts
          </CardTitle>
          <CardTitle>
            <NumberTicker value={insta_data.follower} /> Followers
          </CardTitle>
          <CardTitle>
            <NumberTicker value={insta_data.following} /> Following
          </CardTitle>
        </div>
        <CardDescription>{insta_data.biography}</CardDescription>
      </CardHeader>
    </Card>
  );
};

export default InstaCard;
