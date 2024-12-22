require("dotenv").config();
const express = require("express");
const roastRouter = express.Router();
const {
  addUser,
  getAIResponse,
  addAIResponse,
  getUserData,
  profilesRoasted,
  addCompatiblityResponse,
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
    console.log("Roast Data:", roastData);

    // Download the profile picture to memory
    const profileUrl = roastData.profile_pic_url;
    console.log("Profile URL:", profileUrl);
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

// Route for check Compatiblity
roastRouter.post("/compatiblityRoast", async (req, res) => {
  const uname1 = req.body.uname1;
  const uname2 = req.body.uname2;
  // const language = req.body.language;
  // with this username we need to check is there any record present in compatiblity response table
  // if yes the we will return the response to user

  var userData1 = await getUserData(uname1);
  var userData2 = await getUserData(uname2);
  if (userData1 != null && userData2 != null) {
  }
  if (userData1 == null) {
    userData1 = await getInstagramProfile(uname1);

    console.log("Roast Data:", userData1);

    // Download the profile picture to memory
    const profileUrl = userData1.profile_pic_url;
    console.log("Profile URL:", profileUrl);
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
      userData1.username,
      userData1.full_name,
      userData1.follower,
      userData1.following,
      userData1.biography,
      userData1.post
    );
  }
  if (userData2 == null) {
    userData2 = await getInstagramProfile(uname2);
    console.log("Roast Data:", userData2);

    // Download the profile picture to memory
    const profileUrl = roastData.profile_pic_url;
    console.log("Profile URL:", profileUrl);
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
      userData2.username,
      userData2.full_name,
      userData2.follower,
      userData2.following,
      userData2.biography,
      userData2.post
    );
  }
  // we need to generate the compatiblity response from ai
  // and there we need to add uname uname1 as a foreign key to this compatiblity response table
  const compatiblityText = generateAICompatiblityRoast(
    userData1,
    userData2,
    language
  );
  // add compatiblity roast to our databse table where uname1 and uname2 are foreign key
  // addCompatiblityRoast(compatiblityText,uname1,uname2);
  addCompatiblityResponse(uname1, uname2, compatiblityText);
  return res.status(200).json({
    compatiblity: compatiblityText,
  });
});
module.exports = roastRouter;
