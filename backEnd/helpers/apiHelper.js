require("dotenv").config();
const OpenAI = require("openai");

const getInstagramProfile = async (username) => {
    const url = new URL(`${process.env.URL}` + "/v1/info");
    url.searchParams.append("username_or_id_or_url", username);

    const options = {
        method: "GET",
        headers: {
            "x-rapidapi-key": process.env.X_RAPIDAPI_KEY,
            "x-rapidapi-host": process.env.X_RAPIDAPI_HOST,
        },
    };

    const response = await fetch(url, options);
    const data = await response.json();
    console.log(data);
    const result = data.data;

    const roastData = {
        name: result.full_name,
        userName: result.username,
        follower: result.follower_count,
        following: result.following_count,
        isPrivate: result.is_private,
        bio: result.biography,
        post: result.media_count,
        profile_pic_url: result.profile_pic_url_hd,
    };

    return roastData;
};

const generateAIRoast = async (userData, profileUrl) => {
    const openai = new OpenAI({ apiKey: process.env.APIKEY });
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
};

module.exports = { getInstagramProfile, generateAIRoast };