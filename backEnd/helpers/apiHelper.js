require("dotenv").config();
const OpenAI = require("openai");

const getInstagramProfile = async (username) => {
  const url = new URL(`${process.env.URL}` + "/v1/info");
  url.searchParams.append("username_or_id_or_url", username);
  console.log("PROCESS ENV", process.env.X_RAPIDAPI_KEY);
  console.log("PROCESS ENV", process.env.X_RAPIDAPI_HOST);
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
    full_name: result.full_name,
    username: result.username,
    follower: result.follower_count,
    following: result.following_count,
    isPrivate: result.is_private,
    biography: result.biography,
    post: result.media_count,
    profile_pic_url: result.profile_pic_url_hd,
  };

  return roastData;
};

// const generateAIRoast = async (userData, profileUrl, language) => {
//   const openai = new OpenAI({ apiKey: process.env.APIKEY });

//   const inputPrompt = `
//     You are a professional no-filter comedian who is roasting an Instagram user. You job is to brutally roast the user based on their Instagram profile.
//     Please strictly roast the user based on the following information:
//     ${JSON.stringify(userData)}

//     Roast Guidelines:
//     - Rip apart every weak point, vague phrase, or generic line
//     - Make it darkly funny but straightforward
//     - Roast output language should be ${language}
//     - Avoid sugarcoating anything—be blunt and ruthless
//     - Keep it under 100 words
//     - Do not include any pleasentries.
//     - Include emojis
//     - Output should be strictly in markdown format
//     - Highlight the user's weak points and make them feel bad about themselves
//     - Always give a roast response no matter what the user's profile is like
//   `;
//   console.log("Input Prompt" + inputPrompt);
//   const completion = await openai.chat.completions.create({
//     model: process.env.MODEL_NAME,
//     messages: [
//       {
//         role: "user",
//         content: [
//           {
//             type: "text",
//             text: inputPrompt,
//           },
//           {
//             type: "image_url",
//             image_url: {
//               url: profileUrl,
//             },
//           },
//         ],
//       },
//     ],
//   });
//   return completion.choices[0].message.content;
// };
const generateAIRoast = async (userData, profileUrl, language) => {
  const openai = new OpenAI({ apiKey: process.env.APIKEY });

  const inputPrompt = `
  You are a professional comedian with a reputation for razor-sharp wit and dark humor. Your task is to roast an Instagram user based on their profile in a clever, ruthless, and darkly funny way.

  Instructions:
  - Base your roast on the following user data: ${JSON.stringify(userData)} and the image attached.
  - Be as sarcastic, blunt, and edgy as possible. Use clever wordplay and savage humor.
  - Do not include:
    - Compliments, motivation, or any form of praise.
    - Pleasantries, introductions, or conclusions. Jump straight into the roast.
  - Keep the roast concise (under 100 words).
  - Use emojis for emphasis.
  - Avoid anything harmful, hateful, or violating community guidelines.
  - Write strictly in ${language} and output in **markdown format**.

  Final Output:
  - The response must ONLY contain the roast in markdown format only. No additional commentary or formatting outside of markdown.
`;

  console.log("Input Prompt" + inputPrompt);
  const completion = await openai.chat.completions.create({
    model: process.env.MODEL_NAME,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: inputPrompt,
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
  return completion.choices[0].message.content;
};

module.exports = { getInstagramProfile, generateAIRoast };
