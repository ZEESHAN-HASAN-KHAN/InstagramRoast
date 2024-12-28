import React, { useRef } from "react";
import ShinyButton from "@/components/ui/ShinyButton";

interface ShareableImageProps {
  profileImage: string; // URL of the person's profile image
  name: string; // Person's name
  verified: boolean; // True if verified badge is needed
  username: string; // Person's username
  logo: string; // URL of the predefined logo
  text: string; // Text to display
  date: string; // Date of the post
}

const ShareableImageCanvas: React.FC<ShareableImageProps> = ({
  profileImage,
  name,
  verified,
  username,
  logo,
  text,
  date,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw profile image
    const profileImg = new Image();
    profileImg.crossOrigin = "anonymous";
    // fetch base64 image from the url
    const response = await fetch(profileImage);
    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    profileImg.src = objectURL;

    profileImg.onload = () => {
      ctx.drawImage(profileImg, 20, 20, 50, 50); // x, y, width, height

      // Draw name and username
      ctx.font = "16px Arial";
      ctx.fillStyle = "#000000";
      ctx.fillText(name, 80, 40); // x, y

      if (verified) {
        const verifiedBadge = new Image();
        verifiedBadge.crossOrigin = "anonymous";
        verifiedBadge.src =
          "https://upload.wikimedia.org/wikipedia/commons/e/e4/Twitter_Verified_Badge.svg";
        verifiedBadge.onload = () => {
          ctx.drawImage(verifiedBadge, 180, 25, 16, 16); // x, y, width, height
        };
      }

      ctx.font = "14px Arial";
      ctx.fillStyle = "#555555";
      ctx.fillText(`@${username}`, 80, 60);

      // Draw logo
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.src = logo;
      logoImg.onload = () => {
        ctx.drawImage(logoImg, canvas.width - 60, 20, 40, 40); // x, y, width, height
      };

      // Draw main text
      ctx.font = "16px Arial";
      ctx.fillStyle = "#000000";
      const textLines = text.split("\n");
      textLines.forEach((line, index) => {
        ctx.fillText(line, 20, 100 + index * 20); // x, y
      });

      // Draw date
      ctx.font = "12px Arial";
      ctx.fillStyle = "#888888";
      ctx.fillText(date, 20, canvas.height - 20); // x, y
    };
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "shareable_image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div>
      {/* Hidden Canvas */}
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        style={{ display: "none" }} // Hide the canvas from the user
      ></canvas>

      {/* Button to Generate and Download Image */}
      <ShinyButton
        onClick={() => {
          generateImage();
          downloadImage();
        }}
        className="mt-5 justify-center items-center"
      >
        Generate Shareable Image
      </ShinyButton>
    </div>
  );
};

export default ShareableImageCanvas;

