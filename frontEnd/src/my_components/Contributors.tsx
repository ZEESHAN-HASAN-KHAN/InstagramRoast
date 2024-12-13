import AvatarCircles from "@/components/ui/avatar-circles";

const avatars = [
  {
    imageUrl: "https://avatars.githubusercontent.com/u/60299552?v=4",
    profileUrl: "https://github.com/Arghya721",
  },
  {
    imageUrl: "https://avatars.githubusercontent.com/u/91018365?v=4",
    profileUrl: "https://github.com/ZEESHAN-HASAN-KHAN",
  },
  //   {
  //     imageUrl: "https://avatars.githubusercontent.com/u/106103625",
  //     profileUrl: "https://github.com/BankkRoll",
  //   },
  //   {
  //     imageUrl: "https://avatars.githubusercontent.com/u/59228569",
  //     profileUrl: "https://github.com/safethecode",
  //   },
  //   {
  //     imageUrl: "https://avatars.githubusercontent.com/u/59442788",
  //     profileUrl: "https://github.com/sanjay-mali",
  //   },
  //   {
  //     imageUrl: "https://avatars.githubusercontent.com/u/89768406",
  //     profileUrl: "https://github.com/itsarghyadas",
  //   },
];

export function AvatarCirclesDemo() {
  return <AvatarCircles avatarUrls={avatars} />;
}
