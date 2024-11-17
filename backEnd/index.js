require("dotenv").config();
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.APIKEY });
const express = require("express");
const app = express();
const PORT = process.env.PORT;
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
  const baseURL = process.env.URL;

  try {
    const url = new URL(`${baseURL}` + "/v1/info");
    url.searchParams.append("username_or_id_or_url", name);

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
async function generateAIRoast(userData, profileUrl) {
  const completion = await openai.chat.completions.create({
    model: process.env.MODEL_NAME,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Ap ak dark-comedian hai. Is admi ka profile picture aur iska details se iska roast kijiye." +
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
