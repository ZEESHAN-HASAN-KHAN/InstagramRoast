require("dotenv").config();
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.APIKEY });
const express = require("express");
const app = express();
const PORT = 3000;
const {
  dbConnect,
  addUser,
  checkUserExists,
  getAIResponse,
  addAIResponse,
} = require("./db");
app.use(express.json());

const options = {
  method: "GET",
  headers: {
    "x-rapidapi-key": process.env.X_RAPIDAPI_KEY,
    "x-rapidapi-host": process.env.X_RAPIDAPI_HOST,
  },
};

app.post("/roastMe", async (req, res) => {
  const name = req.body.name;
  const url = process.env.URL + name;
  //get the Instagram Profile Details
  //we'll store that details to our Database

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    const result = data.data;
    //media count is missing
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
    if ((await checkUserExists(roastData.userName)) == false) {
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

      const roast = await test(roastData, result.profile_pic_url);
      await addAIResponse(roastData.userName, roast);
      return res.status(200).json({
        data: roast,
      });
    } else {
      //Data is already there
      console.log("Data is already there");
      // we need to fetch the ai response from the table
      // and return that response
      const aiResponse = await getAIResponse(roastData.userName);
      return res.status(200).json({
        data: aiResponse,
      });
    }
  } catch (e) {
    console.log("Error is " + e);
  }
});

app.listen(PORT, () => {
  dbConnect();
  console.log("App is listening on the Port " + PORT);
});
async function test(userData, profileUrl) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "You're a pro comedian—roast the person below based on their profile picture and details given." +
              JSON.stringify(userData),
          },
          {
            type: "image_url",
            image_url: {
              url: profileUrl,
            },
          },
        ],
      },
    ],
  });
  return JSON.stringify(completion.choices[0].message.content);
}
// test();
