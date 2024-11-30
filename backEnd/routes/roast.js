require("dotenv").config();

const express = require("express");
const roastRouter = express.Router();
const {
  addUser,
  checkUserExists,
  getAIResponse,
  addAIResponse,
} = require("../database/db");
const options = {
  method: "GET",
  headers: {
    "x-rapidapi-key": process.env.X_RAPIDAPI_KEY,
    "x-rapidapi-host": process.env.X_RAPIDAPI_HOST,
  },
};
const generateAIRoast = require("../middleware/generateAIRoast");
roastRouter.post("/roastMe", async (req, res) => {
  const name = req.body.name;
  const baseURL = process.env.URL;

  try {
    const url = new URL(`${baseURL}` + "/v1/info");
    url.searchParams.append("username_or_id_or_url", name);

    const response = await fetch(url, options);
    const data = await response.json();
    const result = data.data;

    const roastData = {
      name: result.full_name,
      userName: result.username,
      follower: result.follower_count,
      following: result.following_count,
      isPrivate: result.is_private,
      bio: result.biography,
      post: result.media_count,
    };

    const profileUrl = result.profile_pic_url;

    //we need to check if user data exist or not
    if (!(await checkUserExists(roastData.userName))) {
      //adding the profile info to database
      await addUser(
        profileUrl,
        roastData.userName,
        roastData.name,
        roastData.follower,
        roastData.following,
        roastData.bio,
        roastData.post
      );
      console.log("Data Added successfully");

      const roast = await generateAIRoast(roastData, result.profile_pic_url);
      addAIResponse(roastData.userName, roast);
      return res.status(200).json({
        insta_data: { ...roastData, profileUrl },
        data: roast,
      });
    } else {
      //Data is already there
      console.log("Data is already in Database");
      // we need to fetch the ai response from the table
      // and return that response
      const aiResponse = await getAIResponse(roastData.userName);
      return res.status(200).json({
        insta_data: { ...roastData, profileUrl },
        data: aiResponse.response_text,
      });
    }
  } catch (e) {
    console.log("Error is " + e);
  }
});

module.exports = roastRouter;
