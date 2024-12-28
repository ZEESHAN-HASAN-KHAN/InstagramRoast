require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT;
const cors = require("cors");
const { dbConnect } = require("./database/db");
const corsOptions = require("./middleware/cors");
const limiter = require("./middleware/rateLimits");
const jwt = require("./middleware/jwt");

const roastRouter = require("./routes/roast");
app.use(express.json());

app.use(cors(corsOptions));
app.use(limiter);
// app.use(jwt);

app.use("/api/v1", roastRouter);

app.listen(PORT, () => {
  dbConnect();
  console.log("App is listening on the Port " + PORT);
});
