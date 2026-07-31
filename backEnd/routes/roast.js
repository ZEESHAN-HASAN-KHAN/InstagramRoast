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
const {
  consumeCredit,
  consumePaidCredit,
  buildRoastKey,
  claimRoastUnlock,
  releaseRoastUnlock,
  refundJobCredit,
  refundSessionCredit,
  expireAndRefundAbandonedJobs,
  FREE_ROAST_LIMIT,
} = require("../database/monetization");
const { getPriceForCountry, PAID_CREDITS_PER_PURCHASE } = require("../helpers/pricing");
const { recordProfileView } = require("../database/engagement");

// The 402 body the frontend's checkout modal renders from. `extra` carries
// context that changes the modal's copy (e.g. the re-roast variant, which can't
// be paid for with free roasts).
function buildPaywallPayload(req, session, extra = {}) {
  const { amount, currency } = getPriceForCountry(req.visitorCountry ?? session.country_code);
  return {
    paywall: true,
    message: "You've used your free roasts — unlock more to keep going.",
    credits: {
      freeUsed: session.free_used,
      freeLimit: FREE_ROAST_LIMIT,
      paidCredits: session.paid_credits,
    },
    price: { amount, currency, credits: PAID_CREDITS_PER_PURCHASE },
    ...extra,
  };
}

// Spends one roast for this visitor, or builds the 402 paywall payload the
// frontend renders its checkout modal from. A delivered roast costs a credit
// whether it came from cache or from a fresh scrape+LLM run, so this runs
// before either path. The credit is handed back if the roast never arrives —
// see refundForFailure below and the failure/cancel paths in roastStream.js.
//
// When this visitor's region has monetization switched off there is no session
// to charge, so the roast is simply free — reported as granted with no credit
// type, which also keeps it out of the refund path.
async function spendRoastCredit(req, target) {
  if (!req.monetizationEnabled || !req.roastSession) {
    return { granted: true, type: null };
  }

  const roastKey = buildRoastKey(target);
  const sessionId = req.roastSession.id;

  // Charge only the first time this session asks for this particular roast.
  // Refreshes, back-navigation and the automatic retry after checkout all land
  // here and are served free — otherwise every page load would spend a credit.
  const isFirstTime = await claimRoastUnlock(sessionId, roastKey);
  if (!isFirstTime) {
    return { granted: true, type: null, roastKey, alreadyUnlocked: true };
  }

  const { granted, type, session } = await consumeCredit({
    sessionId,
    ipAddress: req.clientIp,
  });
  if (granted) return { granted: true, type, roastKey };

  // Nothing to charge — give the claim back so they aren't left holding an
  // unlock for a roast they never got.
  await releaseRoastUnlock(sessionId, roastKey);

  return {
    granted: false,
    payload: buildPaywallPayload(req, session || req.roastSession),
  };
}

// Spends a paid credit for a re-roast. Deliberately does NOT go through
// claimRoastUnlock: the whole point of a re-roast is to pay for another LLM run
// on a profile you've already unlocked, so every one of them charges.
//
// Free roast credits can't pay for it either — see consumePaidCredit. Those
// exist to get someone their first roast; a re-roast is an extra LLM run on a
// profile they've already read.
//
// Where monetization is switched off there's no session to charge, so this is
// free like everything else in that region — visitors there can already roast
// unlimited distinct profiles, each costing a scrape and an LLM call, so a
// re-roast opens no new hole. The per-IP rate limiter caps the spam ceiling.
async function spendRerollCredit(req) {
  if (!req.monetizationEnabled || !req.roastSession) {
    return { granted: true, type: null };
  }

  const { granted, session } = await consumePaidCredit(req.roastSession.id);
  if (granted) return { granted: true, type: "paid" };

  return {
    granted: false,
    payload: buildPaywallPayload(req, session || req.roastSession, {
      reroll: true,
      message: "Re-roasts need a paid credit — grab a pack to keep cooking.",
    }),
  };
}

// Returns the spent credit when the request fails before a roast is delivered.
// Prefers the job-keyed refund (idempotent, so it can't collide with the
// failure path in roastStream.js); falls back to a direct session refund only
// when the blow-up happened before any job row existed.
async function refundForFailure(req, credit, jobId) {
  // No credit type means nothing was charged (already unlocked, or monetization
  // off for this region) — but an unlock claimed moments ago must still be
  // released if it was this request that claimed it.
  if (!credit?.granted) return;
  try {
    if (!credit.type) {
      if (!credit.alreadyUnlocked) {
        await releaseRoastUnlock(req.roastSession?.id, credit.roastKey);
      }
      return;
    }
    if (jobId) {
      await refundJobCredit(jobId); // also releases the unlock
    } else {
      await refundSessionCredit(req.roastSession.id, credit.type);
      await releaseRoastUnlock(req.roastSession.id, credit.roastKey);
    }
  } catch (error) {
    logger.error("Failed to refund roast credit", { jobId, error: error.message });
  }
}

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
  // A re-roast pays to regenerate a roast that already exists, so it skips both
  // the cache shortcut and the once-per-roast unlock.
  const reroll = req.body.reroll === true;

  if (!name) {
    return res.status(400).json({ message: "Username is required" });
  }
  const allowedLanguage = process.env.ALLOWED_LANGUAGE.split(",");
  if (!allowedLanguage.includes(language)) {
    return res.status(500).json({
      message: "API access is restricted",
    });
  }

  let credit = null;
  let jobId = null;

  try {
    const bucketName = process.env.BUCKET_NAME;

    // Cache lookup happens BEFORE the paywall: a roast that already exists costs
    // nothing to serve, and charging for it would break shared links and the
    // SEO landing pages — someone arriving from Google or WhatsApp would be
    // paywalled out of a roast that's already public. Credits pay for
    // *generating* roasts, which is where the scrape and LLM spend actually is.
    // A re-roast skips this entirely — regenerating is exactly what it bought.
    const profile = await getUserData(name);
    if (profile && !reroll) {
      const aiResponse = await getAIResponse(name, language);
      if (aiResponse) {
        // Counted here rather than at generation time: a roast is generated once
        // and then read by everyone who opens the link, and it's the reading
        // that the "most roasted today" board is about.
        recordProfileView(profile.id, req.visitorGeo, {
          sessionId: req.roastSession?.id ?? null,
          ip: req.clientIp,
        });
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
    // language) — this is the part that costs real money, so it's what the
    // paywall guards.
    credit = reroll
      ? await spendRerollCredit(req)
      : await spendRoastCredit(req, { jobType: "single", username: name, language });
    if (!credit.granted) {
      return res.status(402).json(credit.payload);
    }

    requeueStaleJobs(); // opportunistic backstop, not awaited on the hot path
    expireAndRefundAbandonedJobs(); // ditto — returns credits for jobs nobody ever ran
    const job = await createRoastJob({
      jobType: "single",
      username: name,
      language,
      sessionId: req.roastSession?.id ?? null,
      creditType: credit.type,
      roastKey: credit.roastKey ?? null,
      roasterGeo: req.visitorGeo,
      forceRegenerate: reroll,
    });
    jobId = job.id;
    const streamToken = mintStreamToken(job.id);
    publishJobUpdate(job.id, job).catch((error) =>
      logger.error("Failed to publish job update", { error: error.message })
    );
    return res.status(202).json({ done: false, jobId: job.id, streamToken });
  } catch (e) {
    logger.error("Error in /roastMe", { error: e.message, stack: e.stack });
    // Nothing was delivered — don't charge for it.
    await refundForFailure(req, credit, jobId);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Route for check Compatibility
roastRouter.post("/compatibilityRoast", async (req, res) => {
  let credit = null;
  let jobId = null;

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

    // Cache lookup before the paywall, same reasoning as /roastMe: an existing
    // pairing costs nothing to serve, and shared compatibility links should
    // stay openable.
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

    // Cache miss on at least one profile or the pairing — the part that costs
    // real money, so it's what the paywall guards.
    credit = await spendRoastCredit(req, {
      jobType: "compatibility",
      username: uname1,
      username2: uname2,
      language,
    });
    if (!credit.granted) {
      return res.status(402).json(credit.payload);
    }

    requeueStaleJobs(); // opportunistic backstop, not awaited on the hot path
    expireAndRefundAbandonedJobs(); // ditto — returns credits for jobs nobody ever ran
    const job = await createRoastJob({
      jobType: "compatibility",
      username: uname1,
      username2: uname2,
      language,
      sessionId: req.roastSession?.id ?? null,
      creditType: credit.type,
      roastKey: credit.roastKey ?? null,
      roasterGeo: req.visitorGeo,
    });
    jobId = job.id;
    const streamToken = mintStreamToken(job.id);
    publishJobUpdate(job.id, job).catch((error) =>
      logger.error("Failed to publish job update", { error: error.message })
    );
    return res.status(202).json({ done: false, jobId: job.id, streamToken });
  } catch (error) {
    logger.error("Error in /compatibilityRoast", { error: error.message, stack: error.stack });
    // Nothing was delivered — don't charge for it.
    await refundForFailure(req, credit, jobId);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
module.exports = roastRouter;
