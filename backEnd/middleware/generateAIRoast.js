require("dotenv").config();
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.APIKEY });
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
module.exports = generateAIRoast;
