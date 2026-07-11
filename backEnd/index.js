require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT;
const cors = require("cors");
const { dbConnect } = require("./database/db");
const { startPubSub } = require("./database/pubsub");
const corsOptions = require("./middleware/cors");
const limiter = require("./middleware/rateLimits");
const jwt = require("./middleware/jwt");

const roastRouter = require("./routes/roast");
const roastStreamRouter = require("./routes/roastStream");
const logger = require("./helpers/logger");
app.use(express.json());

app.use(cors(corsOptions));
app.use(limiter);

// Mounted before the global JWT middleware: EventSource/sendBeacon can't set an
// Authorization header, so this route verifies its own short-lived streamToken
// (minted at enqueue time) instead.
app.use("/api/v1", roastStreamRouter);

app.use(jwt);

app.use("/api/v1", roastRouter);

app.listen(PORT, () => {
  dbConnect();
  startPubSub().catch((error) => logger.critical("Failed to start pubsub listener", { error: error.message }));
  logger.info("Server started", { port: PORT });
});
