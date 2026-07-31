require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT;
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { dbConnect } = require("./database/db");
const { startPubSub } = require("./database/pubsub");
const corsOptions = require("./middleware/cors");
const limiter = require("./middleware/rateLimits");
const jwt = require("./middleware/jwt");
const session = require("./middleware/session");

const roastRouter = require("./routes/roast");
const engagementRouter = require("./routes/engagement");
const roastStreamRouter = require("./routes/roastStream");
const paymentRouter = require("./routes/payment");
const paymentWebhookRouter = require("./routes/paymentWebhook");
const logger = require("./helpers/logger");

// Needed for req.ip to report the real client behind the platform's load
// balancer instead of the proxy's own address — the per-IP free-roast cap and
// the geo pricing lookup both key off it. The hop count must match the actual
// deployment (1 = a single reverse proxy in front of this process).
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS) || 1);

// Razorpay and PayPal both sign the raw webhook bytes, so these routes must
// keep their unparsed bodies. Mounted ahead of express.json(), which then skips
// them (body-parser won't re-read a request an earlier parser already consumed).
app.use("/api/v1/payment/webhook", express.raw({ type: "application/json" }));
app.use("/api/v1/payment/paypal/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(cookieParser());

app.use(cors(corsOptions));
app.use(limiter);

// Mounted before the global JWT middleware: EventSource/sendBeacon can't set an
// Authorization header, so this route verifies its own short-lived streamToken
// (minted at enqueue time) instead.
app.use("/api/v1", roastStreamRouter);

// Also before JWT — Razorpay's servers authenticate via the webhook HMAC.
app.use("/api/v1", paymentWebhookRouter);

app.use(jwt);

// Establishes req.roastSession (and mints the roast_session cookie on first
// visit) for every authenticated route, so the cookie exists from the first page
// load rather than only once someone tries to roast.
app.use(session);

app.use("/api/v1", roastRouter);
// After `session` — ratings key off req.roastSession / req.clientIp, and the
// geo-scoped feeds off req.visitorGeo, all of which that middleware establishes.
app.use("/api/v1", engagementRouter);
app.use("/api/v1", paymentRouter);

app.listen(PORT, () => {
  dbConnect();
  startPubSub().catch((error) => logger.critical("Failed to start pubsub listener", { error: error.message }));
  logger.info("Server started", { port: PORT });
});
