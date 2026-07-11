const jwt = require("jsonwebtoken");

const mintStreamToken = (jobId) => {
  const ttl = process.env.STREAM_TOKEN_TTL || "10m";
  return jwt.sign({ jobId, scope: "stream" }, process.env.TOKEN_SECRET, { expiresIn: ttl });
};

// Returns the verified payload, or null if the token is invalid, expired, or
// scoped to a different job than the one being requested.
const verifyStreamToken = (token, jobId) => {
  try {
    const payload = jwt.verify(token, process.env.TOKEN_SECRET);
    if (payload.scope !== "stream" || payload.jobId !== jobId) return null;
    return payload;
  } catch {
    return null;
  }
};

module.exports = { mintStreamToken, verifyStreamToken };
