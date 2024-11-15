require('dotenv').config()
const express = require('express')
const app = express();
const PORT = 3000
app.use(express.json());

const options = {
  method: 'GET',
  headers: {
    'x-rapidapi-key': process.env.X_RAPIDAPI_KEY,
    'x-rapidapi-host': process.env.X_RAPIDAPI_HOST
  }
};

app.post('/roastMe',async (req, res) => {
    const name = req.body.name;
    const url = process.env.URL+name;
    //get the Instagram Profile Details
    //we'll store that details to our Database

    try {
        const response = await fetch(url, options);
	    const result = await response.text();
        return res.status(200).json({
        data:result
    })
    }
    catch (e)
    {
        console.log('Error is ' + e);
    }
})


app.listen(PORT,() => {
    console.log('App is listening on the Port ' + PORT)
});
// const OpenAI=require('openai')
// const openai = new OpenAI({apiKey:''});
// async function test() {

//   const completion = await openai.chat.completions.create({
//     model: "gpt-4o-mini",
//     messages: [
//       { "role": "user", "content": "write a haiku about ai" }
//     ]
//   });
//   console.log(completion);
// }
// test();

// console.log(JSON.stringify({
//   "profile_pic_url": "https://scontent-mxp2-1.cdninstagram.com/v/t51.2885-19/404042911_235414609558714_3765834583032986184_n.jpg?stp=dst-jpg_e0_s150x150&_nc_ht=scontent-mxp2-1.cdninstagram.com&_nc_cat=110&_nc_ohc=DQtCQpK7ib4Q7kNvgHn7dZL&_nc_gid=e7509c2d90614156bfd7028a88afb004&edm=AO4kU9EBAAAA&ccb=7-5&oh=00_AYDEXG5TN4g4NEcCnZUQmS3e5ZsYLb8cmaSoZ25zaL8mxQ&oe=673B4428&_nc_sid=164c1d",
//   "biography": "Software Engineer 🧑‍💻",
//   "follower_count": 86,
//   "following_count": 81,
//   "is_private": false,
//   "username": "_arghya.deep_",
//   "full_name": "Arghyadeep Ghosh",
//   "media_count": 4
// }
// ))

