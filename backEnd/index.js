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
    //return the roasting text
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
