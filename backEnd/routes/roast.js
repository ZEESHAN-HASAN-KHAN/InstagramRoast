require("dotenv").config();
const express = require("express");
const roastRouter = express.Router();
const logger = require("../helpers/logger");
const {
  profilesRoasted,
  getUserData,
  getAIResponse,
  checkCompatibilityResponse,
  getDeepReading,
  saveDeepReading,
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
const { parseBirthDate, SIGN_META } = require("../helpers/zodiac");
const { generateCosmicDeep } = require("../helpers/cosmicDeep");
const { isDeepReadingFree } = require("../helpers/devAccess");

// Instagram handles are ASCII letters, digits, dots and underscores, capped at
// 30. Anything else is a crafted request, so it is rejected rather than
// sanitised — a "cleaned" hostile handle is still a lookup nobody asked for.
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

function cleanHandleInput(value) {
  const handle = String(value ?? "").trim().replace(/^@+/, "");
  return HANDLE.test(handle) ? handle : null;
}

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

// Public profile facts for the paywall's teaser card, so the wall can show WHAT
// is being unlocked instead of a bare price. Only ever data already in our
// cache — a visitor who hasn't paid never triggers a scrape.
function buildProfilePreview(username, profile, bucketName) {
  if (!profile) return { username, profile: null };
  return {
    username,
    profile: {
      username: profile.username,
      full_name: profile.full_name,
      profile_pic_url: `https://storage.googleapis.com/${bucketName}/${profile.profile_pic_url}`,
      follower: profile.follower,
      following: profile.following,
      post: profile.post,
      biography: profile.biography,
    },
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

// Charges for the paid deep reading. Paid credits only, for the same reason
// spendRerollCredit refuses free ones: the free tier exists to deliver a first
// result, and this is the upsell that result advertises.
//
// Unlike a re-roast it does go through claimRoastUnlock, because a deep reading
// is a permanent artefact rather than a fresh generation — refreshing the page
// must not charge twice for the same six paragraphs.
async function spendDeepCredit(req, target) {
  if (!req.monetizationEnabled || !req.roastSession) {
    return { granted: true, type: null };
  }

  // Local development only, and only for requests whose TCP peer is loopback.
  // See helpers/devAccess.js for why this cannot be reached from the internet.
  // Returns before claimRoastUnlock so a dev can re-run the same pairing as
  // many times as they like without clearing session_unlocks by hand.
  if (isDeepReadingFree(req)) {
    return { granted: true, type: null, devBypass: true };
  }

  const roastKey = buildRoastKey({ jobType: "deepmatch", ...target });
  const sessionId = req.roastSession.id;

  const isFirstTime = await claimRoastUnlock(sessionId, roastKey);
  if (!isFirstTime) {
    return { granted: true, type: null, roastKey, alreadyUnlocked: true };
  }

  const { granted, session } = await consumePaidCredit(sessionId);
  if (granted) return { granted: true, type: "paid", roastKey };

  // Give the claim back, or they hold an unlock for a reading they never got.
  await releaseRoastUnlock(sessionId, roastKey);

  return {
    granted: false,
    roastKey,
    payload: buildPaywallPayload(req, session || req.roastSession, {
      deep: true,
      message: "The full reading needs a paid credit — grab a pack to see how this ends.",
    }),
  };
}

// Undoes spendDeepCredit when the reading could not be delivered. Safe to call
// with a null credit or one that was never charged (an already-unlocked repeat
// view spends nothing), so the error paths can call it unconditionally.
async function releaseDeepCredit(req, credit) {
  if (!credit || !credit.granted || !credit.roastKey || !req.roastSession) return;
  if (credit.alreadyUnlocked) return;
  try {
    if (credit.type) await refundSessionCredit(req.roastSession.id, credit.type);
    await releaseRoastUnlock(req.roastSession.id, credit.roastKey);
  } catch (error) {
    logger.error("[cosmicDeep] failed to release credit", { error: error.message });
  }
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
      // `profile` is whatever the cache lookup above found (always present on a
      // re-roast, sometimes on a first roast in a new language) — free teaser data.
      return res.status(402).json({
        ...credit.payload,
        preview: buildProfilePreview(name, profile, bucketName),
      });
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

    // Cosmic Match birth dates. Optional — a pairing with neither runs the
    // original compatibility roast. Anything that is not a real "YYYY-MM-DD"
    // in a plausible birth year is dropped to null rather than rejected: a
    // garbled date is a client bug or a bot, and failing the whole request
    // over it would cost a conversion the plain roast could still have served.
    const dob1 = parseBirthDate(req.body.dob1) ? String(req.body.dob1).trim() : null;
    const dob2 = parseBirthDate(req.body.dob2) ? String(req.body.dob2).trim() : null;

    const bucketName = process.env.BUCKET_NAME;

    // Cache lookup before the paywall, same reasoning as /roastMe: an existing
    // pairing costs nothing to serve, and shared compatibility links should
    // stay openable. The birth dates are part of the key — see
    // checkCompatibilityResponse for why.
    const userData1 = await getUserData(uname1);
    const userData2 = await getUserData(uname2);
    if (userData1 && userData2) {
      const check = await checkCompatibilityResponse(userData1.id, userData2.id, language, dob1, dob2);
      if (check.success) {
        const hydrate = (name) => {
          if (!name) return null;
          const meta = SIGN_META[name];
          return meta ? { name, emoji: meta.emoji, element: meta.element } : { name };
        };
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
            score: check.score ?? null,
            greenFlag: check.greenFlag ?? null,
            redFlag: check.redFlag ?? null,
            verdict: check.verdict ?? null,
            sign1: hydrate(check.sign1),
            sign2: hydrate(check.sign2),
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
      return res.status(402).json({
        ...credit.payload,
        preview: {
          ...buildProfilePreview(uname1, userData1, bucketName),
          username2: uname2,
        },
      });
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
      birthDate1: dob1,
      birthDate2: dob2,
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

// ── Cosmic Match: the paid deep reading ───────────────────────────────────
//
// Synchronous rather than queued, unlike every other LLM call here: both
// profiles are already scraped by the time anyone can reach this button, so
// there is no network fan-out to hide behind a progress ladder — just one model
// call. A job row would add a queue hop and a stream connection to something
// that finishes in the time the button spends showing a spinner.
//
// Charging works like a re-roast, not like a first roast: paid credits only.
// Free credits exist to get someone their first result; this is the upsell that
// first result is advertising, and letting a free credit buy it would mean the
// free tier funds the paid tier.
roastRouter.post("/cosmicMatch/deep", async (req, res) => {
  let credit = null;
  let roastKey = null;

  try {
    const uname1 = cleanHandleInput(req.body.uname1);
    const uname2 = cleanHandleInput(req.body.uname2);
    if (!uname1 || !uname2 || uname1.toLowerCase() === uname2.toLowerCase()) {
      return res.status(400).json({ message: "Invalid User Name" });
    }

    const language = req.body.language;
    const allowedLanguage = process.env.ALLOWED_LANGUAGE.split(",");
    if (!allowedLanguage.includes(language)) {
      return res.status(403).json({ message: "API access is restricted" });
    }

    const dob1 = parseBirthDate(req.body.dob1) ? String(req.body.dob1).trim() : null;
    const dob2 = parseBirthDate(req.body.dob2) ? String(req.body.dob2).trim() : null;

    const userData1 = await getUserData(uname1);
    const userData2 = await getUserData(uname2);
    // The deep reading is bought from a match that already exists. Reaching
    // here without one means a hand-crafted request or a stale tab, not a
    // journey worth charging for.
    if (!userData1 || !userData2) {
      return res.status(404).json({ message: "Run the match first." });
    }

    const base = await checkCompatibilityResponse(userData1.id, userData2.id, language, dob1, dob2);
    if (!base.success) {
      return res.status(404).json({ message: "Run the match first." });
    }

    // Served before the paywall so a refresh, a back-navigation or a reopened
    // share link never re-charges for a reading that already exists.
    const existing = await getDeepReading(userData1.id, userData2.id, language, dob1, dob2);
    if (existing) {
      return res.status(200).json({ done: true, reading: existing, cached: true });
    }

    credit = await spendDeepCredit(req, {
      username: uname1,
      username2: uname2,
      language,
      birthDate1: dob1,
      birthDate2: dob2,
    });
    roastKey = credit.roastKey ?? null;
    if (!credit.granted) {
      return res.status(402).json(credit.payload);
    }

    const { id: _id1, profile_pic_url: _pic1, ...promptData1 } = userData1;
    const { id: _id2, profile_pic_url: _pic2, ...promptData2 } = userData2;
    const reading = await generateCosmicDeep(
      promptData1,
      promptData2,
      language,
      dob1,
      dob2,
      base.compatibilityText
    );

    // A model response too broken to parse is not something to charge for.
    if (!reading) {
      await releaseDeepCredit(req, credit);
      return res.status(502).json({ message: "The stars were unreadable. Try again." });
    }

    const saved = await saveDeepReading(userData1.id, userData2.id, language, reading, dob1, dob2);
    if (!saved) {
      // Generated but unstorable: hand it over anyway rather than burning the
      // purchase, and give the credit back since it will be gone on refresh.
      logger.error("[cosmicDeep] generated but not persisted", { uname1, uname2, language });
      await releaseDeepCredit(req, credit);
    }

    return res.status(200).json({ done: true, reading, cached: false });
  } catch (error) {
    logger.error("Error in /cosmicMatch/deep", { error: error.message, stack: error.stack });
    await releaseDeepCredit(req, credit);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = roastRouter;
