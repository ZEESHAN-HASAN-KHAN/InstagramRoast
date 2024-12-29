import React, { useMemo, useRef } from "react";
import html2canvas from "html2canvas"; // Import html2canvas
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog"; // Adjust the import path based on your ShadCN setup
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ShinyButton from "@/components/ui/ShinyButton";
import VerifiedTwitter from "../assets/Twitter_Verified_Badge.png";

interface ShareableImageProps {
  profileImage: string; // URL of the person's profile image
  name: string; // Person's name
  verified: boolean; // True if verified badge is needed
  username: string; // Person's username
  logo: string; // URL of the predefined logo
  text: string; // Text to display
  date: string; // Date of the post
}

const ShareableRoastImage: React.FC<ShareableImageProps> = ({
  profileImage,
  name,
  verified,
  username,
  logo,
  text,
  date,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  const shareScreenshot = async () => {
    if (!dialogRef.current) return;

    try {
      const canvas = await html2canvas(dialogRef.current, {
        useCORS: true, // Ensure cross-origin images are handled
        logging: true, // Enable logging to debug if needed
        allowTaint: true, // Allow tainted images if required
      });
      const dataUrl = canvas.toDataURL("image/png"); // Convert canvas to Data URL

      const blob = await (await fetch(dataUrl)).blob(); // Convert Data URL to Blob
      const file = new File([blob], "shareable_image.png", { type: "image/png" });

      // Use Web Share API
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: "Check out this roast!",
          text: "Here's a hilarious roast I just got:",
        });
      } else {
        alert("Sharing is not supported on this device.");
      }
    } catch (error) {
      console.error("Error capturing screenshot or sharing:", error);
    }
  };

  const renderedMarkdown = useMemo(
    () => (
      <div className="prose break-all whitespace-normal font-medium text-gray-900">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    ),
    [text]
  );

  return (
    <div>
      {/* ShadCN Dialog */}
      <Dialog>
        {/* Button to Open Dialog */}
        <DialogTrigger asChild>
          <ShinyButton className="mt-5">Share this roast as Image</ShinyButton>
        </DialogTrigger>

        {/* Dialog Content */}
        <DialogContent className="max-w-lg">
          <div
            ref={dialogRef}
            className="bg-white p-6 rounded-lg shadow-lg w-full h-auto mt-5"
          >
            {/* Profile Image and Details */}
            <div className="flex items-center mb-4">
              <img
                src={
                  profileImage.startsWith("data:image")
                    ? profileImage
                    : `data:image/jpeg;base64,${profileImage}`
                }
                alt="Profile"
                className="w-12 h-12 rounded-full"
              />
              <div className="ml-4">
                <div className="font-bold text-lg text-black">
                  {name}
                  {verified && (
                    <img
                      src={VerifiedTwitter}
                      alt="Verified"
                      className="w-4 h-4 inline-block ml-1"
                    />
                  )}
                  <img
                    src={logo}
                    alt="Logo"
                    className="absolute top-16 right-12 w-10 h-10"
                  />
                </div>

                <div className="text-gray-500">@{username}</div>
              </div>
            </div>

            {/* Main Text */}
            <div className="text-base text-black">{renderedMarkdown}</div>

            {/* Date */}
            <div className="text-gray-400 text-sm mt-4">{date}</div>
          </div>

          {/* Share Button */}
          <div className="mt-4 flex justify-end">
            <ShinyButton onClick={shareScreenshot}>Share</ShinyButton>
          </div>

          {/* Close Button */}
          <DialogClose asChild>
            <ShinyButton className="ml-4">Close</ShinyButton>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShareableRoastImage;