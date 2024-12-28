require("dotenv").config();
const express = require("express");
const roastRouter = express.Router();
const { createCanvas, loadImage } = require("canvas");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const {
  addUser,
  getAIResponse,
  addAIResponse,
  getUserData,
  profilesRoasted,
  addCompatiblityResponse,
  checkCompatibilityResponse,
} = require("../database/db");
const {
  generateAIRoast,
  getInstagramProfile,
  generateAICompatiblityRoast,
} = require("../helpers/apiHelper");
const { uploadImage } = require("../helpers/storageHelper");

roastRouter.get("/roastCount", async (req, res) => {
  try {
    const num = await profilesRoasted();

    return res.status(200).json({
      count: num,
    });
  } catch (error) {
    console.error("Error from roast count");
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

roastRouter.post("/roastMe", async (req, res) => {
  const name = req.body.name;
  const language = req.body.language;
  //Check the language
  const allowedLanguage = process.env.ALLOWED_LANGUAGE.split(",");
  if (!allowedLanguage.includes(language)) {
    return res.status(500).json({
      message: "API access is restricted",
    });
  }

  try {
    // Get the Instagram profile data from database
    const result = await getUserData(name);
    const bucketName = process.env.BUCKET_NAME;
    // if data is present in database
    if (result) {
      console.log("Data is already in Database");
      result.profile_pic_url = `https://storage.googleapis.com/${bucketName}/${result.profile_pic_url}`;

      // Fetch the AI response from the table and return it
      const aiResponse = await getAIResponse(name, language);
      if (aiResponse) {
        return res.status(200).json({
          insta_data: result,
          data: aiResponse.response_text,
        });
      } else {
        // generate AI response and return it
        const roast = await generateAIRoast(
          // Create a copy of the result object excluding profile_pic_url
          (() => {
            const { profile_pic_url, ...rest } = result; // Destructure to exclude profile_pic_url
            return rest; // Return the remaining object
          })(),
          result.profile_pic_url,
          language
        );
        addAIResponse(name, roast, language);
        return res.status(200).json({
          insta_data: result,
          data: roast,
        });
      }
    }

    // Fetch the Instagram profile data
    const roastData = await getInstagramProfile(name);

    // Download the profile picture to memory
    const profileUrl = roastData.profile_pic_url;
    const imageResponse = await fetch(profileUrl);

    // Convert the image response to a Buffer
    if (!imageResponse.ok) {
      throw new Error(
        `Failed to fetch profile picture: ${imageResponse.statusText}`
      );
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const fileName = await uploadImage(imageBuffer);
    const gcsProfileUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

    await addUser(
      fileName,
      roastData.username,
      roastData.full_name,
      roastData.follower,
      roastData.following,
      roastData.biography,
      roastData.post
    );

    // roast instagram profile data
    const roast = await generateAIRoast(
      () => {
        const { profile_pic_url, ...rest } = roastData; // Destructure to exclude profile_pic_url
        return rest; // Return the remaining object
      },
      roastData.profile_pic_url,
      language
    );
    // Update roastData with the GCS URL
    roastData.profile_pic_url = gcsProfileUrl;
    addAIResponse(name, roast, language);

    return res.status(200).json({
      insta_data: roastData,
      data: roast,
    });
  } catch (e) {
    console.error("Error:", e);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Route for check Compatibility
roastRouter.post("/compatibilityRoast", async (req, res) => {
  try {
    const bucketName = process.env.BUCKET_NAME;
    const uname1 = req.body.uname1;
    const uname2 = req.body.uname2;
    if (
      uname1 == uname2 ||
      uname1 == "" ||
      uname2 == "" ||
      uname1 == null ||
      uname2 == null
    ) {
      return res.status(500).json({
        message: "Invalid User Name",
      });
    }

    const language = req.body.language;
    //Check the language
    const allowedLanguage = process.env.ALLOWED_LANGUAGE.split(",");
    if (!allowedLanguage.includes(language)) {
      return res.status(500).json({
        message: "API access is restricted",
      });
    }

    let profileUrl1;
    let profileUrl2;
    let userData1 = await getUserData(uname1);
    let userData2 = await getUserData(uname2);
    if (userData1 != null && userData2 != null) {
      const check = await checkCompatibilityResponse(
        userData1.id,
        userData2.id,
        language
      );
      if (check.success) {
        userData1.profile_pic_url = `https://storage.googleapis.com/${bucketName}/${userData1.profile_pic_url}`;
        userData2.profile_pic_url = `https://storage.googleapis.com/${bucketName}/${userData2.profile_pic_url}`;
        return res.status(200).json({
          userData1: userData1,
          userData2: userData2,
          compatibilityText: check.compatibilityText,
        });
      }
    }
    // if user data is not present in database
    if (userData1 == null) {
      userData1 = await getInstagramProfile(uname1);

      // Download the profile picture to memory
      profileUrl1 = userData1.profile_pic_url;
      const imageResponse = await fetch(profileUrl1);

      // Convert the image response to a Buffer
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch profile picture: ${imageResponse.statusText}`
        );
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      const fileName = await uploadImage(imageBuffer);
      userData1.profile_pic_url = fileName;

      if (userData1.username) {
        await addUser(
          fileName,
          userData1.username,
          userData1.full_name,
          userData1.follower,
          userData1.following,
          userData1.biography,
          userData1.post
        );
      } else {
        throw new Error("Invalid user data: username is null");
      }
    }

    if (userData2 == null) {
      // return ivalid user name if we don't get the profile
      userData2 = await getInstagramProfile(uname2);

      // Download the profile picture to memory
      profileUrl2 = userData2.profile_pic_url;
      const imageResponse = await fetch(profileUrl2);

      // Convert the image response to a Buffer
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch profile picture: ${imageResponse.statusText}`
        );
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      const fileName = await uploadImage(imageBuffer);
      userData2.profile_pic_url = fileName;

      if (userData2.username) {
        await addUser(
          fileName,
          userData2.username,
          userData2.full_name,
          userData2.follower,
          userData2.following,
          userData2.biography,
          userData2.post
        );
      } else {
        throw new Error("Invalid user data: username is null");
      }
    }

    const compatibilityText = await generateAICompatiblityRoast(
      // remove id and profile_pic_url from the object
      (() => {
        const { id, profile_pic_url, ...rest } = userData1;
        return rest;
      })(),
      (() => {
        const { id, profile_pic_url, ...rest } = userData2;
        return rest;
      })(),
      language
    );

    await addCompatiblityResponse(uname1, uname2, compatibilityText, language);
    userData1.profile_pic_url = `https://storage.googleapis.com/${bucketName}/${userData1.profile_pic_url}`;
    userData2.profile_pic_url = `https://storage.googleapis.com/${bucketName}/${userData2.profile_pic_url}`;
    return res.status(200).json({
      userData1: userData1,
      userData2: userData2,
      compatibilityText: compatibilityText,
    });
  } catch (error) {
    console.error("Error from Compatibility Roast " + error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

roastRouter.post("/generate-sharable-roast-image", async (req, res) => {
  const { profileImage, name, verified, username, logo, text, date } = req.body;

  const canvas = createCanvas(400, 300);
  const ctx = canvas.getContext("2d");

  try {
    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fetch profile image and draw it
    const profileImg = await fetchImage(profileImage);
    ctx.drawImage(profileImg, 20, 20, 50, 50);

    // Draw name and username
    ctx.font = "16px Arial";
    ctx.fillStyle = "#000000";
    ctx.fillText(name, 80, 40);

    if (verified) {
      const verifiedBadge = await fetchImage(
        "https://upload.wikimedia.org/wikipedia/commons/e/e4/Twitter_Verified_Badge.svg"
      );
      ctx.drawImage(verifiedBadge, 180, 25, 16, 16);
    }

    ctx.font = "14px Arial";
    ctx.fillStyle = "#555555";
    ctx.fillText(`@${username}`, 80, 60);

    // Fetch logo and draw it
    const logoImg = await fetchImage(logo);
    ctx.drawImage(logoImg, canvas.width - 60, 20, 40, 40);

    // Draw main text
    ctx.font = "16px Arial";
    ctx.fillStyle = "#000000";
    const textLines = text.split("\n");
    textLines.forEach((line, index) => {
      ctx.fillText(line, 20, 100 + index * 20);
    });

    // Draw date
    ctx.font = "12px Arial";
    ctx.fillStyle = "#888888";
    ctx.fillText(date, 20, canvas.height - 20);

    // Send the image as a response
    const buffer = canvas.toBuffer("image/png");
    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).send("Error generating image");
  }
});

async function fetchImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return loadImage(buffer);
}

module.exports = roastRouter;
