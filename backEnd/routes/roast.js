require("dotenv").config();
const express = require("express");
const roastRouter = express.Router();
const logger = require("../helpers/logger");
const {
  profilesRoasted,
  getUserData,
  getAIResponse,
  checkCompatibilityResponse,
} = require("../database/db");
const { createRoastJob, requeueStaleJobs } = require("../database/roastJobs");
const { mintStreamToken } = require("../helpers/streamToken");
const { publishJobUpdate } = require("../database/pubsub");

roastRouter.get("/roastCount", async (req, res) => {
  try {
    const num = await profilesRoasted();

    return res.status(200).json({
      count: num,
    });
  } catch (error) {
    logger.error("Error from roast count", { error: error.message });
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

roastRouter.post("/roastMe", async (req, res) => {
  const name = req.body.name;
  const language = req.body.language;

  if (!name) {
    return res.status(400).json({ message: "Username is required" });
  }
  const allowedLanguage = process.env.ALLOWED_LANGUAGE.split(",");
  if (!allowedLanguage.includes(language)) {
    return res.status(500).json({
      message: "API access is restricted",
    });
  }

  try {
    const bucketName = process.env.BUCKET_NAME;

    // Fully cached (profile + roast for this language already exist): answer
    // immediately, no queue/SSE round-trip needed for something that costs
    // nothing to fetch.
    const profile = await getUserData(name);
    if (profile) {
      const aiResponse = await getAIResponse(name, language);
      if (aiResponse) {
        return res.status(200).json({
          done: true,
          result: {
            insta_data: {
              ...profile,
              profile_pic_url: `https://storage.googleapis.com/${bucketName}/${profile.profile_pic_url}`,
            },
            data: aiResponse.response_text,
          },
        });
      }
    }

    // Cache miss (new profile, or profile cached but not yet roasted in this
    // language) — needs real scrape/LLM work, goes through the queue+SSE flow.
    requeueStaleJobs(); // opportunistic backstop, not awaited on the hot path
    const job = await createRoastJob({ jobType: "single", username: name, language });
    const streamToken = mintStreamToken(job.id);
    publishJobUpdate(job.id, job).catch((error) =>
      logger.error("Failed to publish job update", { error: error.message })
    );
    return res.status(202).json({ done: false, jobId: job.id, streamToken });
  } catch (e) {
    logger.error("Error in /roastMe", { error: e.message, stack: e.stack });
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Route for check Compatibility
roastRouter.post("/compatibilityRoast", async (req, res) => {
  try {
    const uname1 = req.body.uname1;
    const uname2 = req.body.uname2;
    if (
      uname1 == uname2 ||
      uname1 == "" ||
      uname2 == "" ||
      uname1 == null ||
      uname2 == null
    ) {
      return res.status(500).json({
        message: "Invalid User Name",
      });
    }

    const language = req.body.language;
    const allowedLanguage = process.env.ALLOWED_LANGUAGE.split(",");
    if (!allowedLanguage.includes(language)) {
      return res.status(500).json({
        message: "API access is restricted",
      });
    }

    const bucketName = process.env.BUCKET_NAME;

    // Fully cached (both profiles + a compatibility roast for this language
    // pair already exist): answer immediately, no queue/SSE needed.
    const userData1 = await getUserData(uname1);
    const userData2 = await getUserData(uname2);
    if (userData1 && userData2) {
      const check = await checkCompatibilityResponse(userData1.id, userData2.id, language);
      if (check.success) {
        return res.status(200).json({
          done: true,
          result: {
            userData1: {
              ...userData1,
              profile_pic_url: `https://storage.googleapis.com/${bucketName}/${userData1.profile_pic_url}`,
            },
            userData2: {
              ...userData2,
              profile_pic_url: `https://storage.googleapis.com/${bucketName}/${userData2.profile_pic_url}`,
            },
            compatibilityText: check.compatibilityText,
          },
        });
      }
    }

    // Cache miss on at least one profile or the pairing — needs real
    // scrape/LLM work, goes through the queue+SSE flow.
    requeueStaleJobs(); // opportunistic backstop, not awaited on the hot path
    const job = await createRoastJob({
      jobType: "compatibility",
      username: uname1,
      username2: uname2,
      language,
    });
    const streamToken = mintStreamToken(job.id);
    publishJobUpdate(job.id, job).catch((error) =>
      logger.error("Failed to publish job update", { error: error.message })
    );
    return res.status(202).json({ done: false, jobId: job.id, streamToken });
  } catch (error) {
    logger.error("Error in /compatibilityRoast", { error: error.message, stack: error.stack });
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
module.exports = roastRouter;
