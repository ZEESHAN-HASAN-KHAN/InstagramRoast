const { Pool } = require("pg");
const logger = require("../helpers/logger");

const pool = new Pool({
  connectionString: process.env.DB,
  ssl: {
    rejectUnauthorized: false, // For self-signed certificates
  },
});

async function getUserData(username) {
  try {
    const result = await pool.query(
      `SELECT
        id,
         profile_pic_url, 
         username, 
         full_name, 
         follower, 
         following, 
         biography, 
         post 
       FROM profiles 
       WHERE username = $1;`,
      [username]
    );

    if (result.rows.length === 0) {
      // console.log("User data not found in the database.");
      return null; // Return null if the user data does not exist
    }

    // console.log("User data retrieved:", result.rows[0]);
    return result.rows[0]; // Return the user data
  } catch (error) {
    logger.error("Error fetching user data", { error: error.message });
    throw error;
  }
}

async function dbConnect() {
  logger.info("Attempting to connect to the database");
  try {
    await pool.query("SELECT 1");
    logger.info("Database connected");

    const result = await pool.query(`
                      CREATE TABLE IF NOT EXISTS profiles (
                  id SERIAL PRIMARY KEY,
                  profile_pic_url TEXT,
                  username VARCHAR(50) UNIQUE NOT NULL,
                  full_name VARCHAR(255),
                  follower INTEGER,
                  following INTEGER,
                  biography TEXT,
                  post INTEGER,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
  
          `);
    const result2 = await pool.query(`
              CREATE TABLE IF NOT EXISTS ai_responses (
                  id SERIAL PRIMARY KEY,
                  profile_id INTEGER NOT NULL,
                  response_text TEXT NOT NULL,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
              );
          `);
    const result3 = await pool.query(`
      CREATE TABLE IF NOT EXISTS compatibility_responses (
        id SERIAL PRIMARY KEY,
        profile_id_1 INTEGER NOT NULL,
        profile_id_2 INTEGER NOT NULL,
        compatibility_score INTEGER,
        compatibility_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id_1) REFERENCES profiles (id) ON DELETE CASCADE,
        FOREIGN KEY (profile_id_2) REFERENCES profiles (id) ON DELETE CASCADE
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roast_jobs (
        id              UUID PRIMARY KEY,
        job_type        VARCHAR(20) NOT NULL CHECK (job_type IN ('single','compatibility')),
        status          VARCHAR(20) NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued','processing','done','failed','cancelled')),
        stage           VARCHAR(40),
        stage_index     INTEGER DEFAULT 0,
        total_stages    INTEGER,
        stage_message   TEXT,
        username        VARCHAR(50),
        username_2      VARCHAR(50),
        language        VARCHAR(20) NOT NULL,
        cancellation_requested BOOLEAN NOT NULL DEFAULT false,
        result          JSONB,
        error_message   TEXT,
        locked_by       TEXT,
        locked_at       TIMESTAMP WITH TIME ZONE,
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Added after roast_jobs shipped, so these are ALTERs rather than columns in
    // the CREATE above — existing deployments already have the table.
    // A job records which credit bucket paid for it so a failed/cancelled roast
    // can hand exactly that one back (see refundJobCredit).
    await pool.query(`
      ALTER TABLE roast_jobs ADD COLUMN IF NOT EXISTS session_id UUID;
      ALTER TABLE roast_jobs ADD COLUMN IF NOT EXISTS credit_type VARCHAR(10);
      ALTER TABLE roast_jobs ADD COLUMN IF NOT EXISTS credit_refunded BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE roast_jobs ADD COLUMN IF NOT EXISTS roast_key TEXT;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_roast_jobs_queued ON roast_jobs (created_at) WHERE status = 'queued';
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_roast_jobs_stale ON roast_jobs (locked_at) WHERE status = 'processing';
    `);

    // Anonymous per-visitor entitlement: keyed by the `roast_session` cookie, no
    // accounts involved. `ip_address`/`country_code` are pinned to what was seen
    // when the row was first created (see getOrCreateSession).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roast_sessions (
        id            UUID PRIMARY KEY,
        ip_address    VARCHAR(45) NOT NULL,
        country_code  VARCHAR(4),
        free_used     INTEGER NOT NULL DEFAULT 0,
        paid_credits  INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Supports the cross-session per-IP free-usage sum in consumeCredit().
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_roast_sessions_ip ON roast_sessions (ip_address);
    `);
    // Finer-grained location than the country code the pricing bracket needs,
    // added for the "people near you" discovery feeds and the regional
    // leaderboards. Pinned at session creation like ip_address/country_code.
    await pool.query(`
      ALTER TABLE roast_sessions ADD COLUMN IF NOT EXISTS region VARCHAR(80);
      ALTER TABLE roast_sessions ADD COLUMN IF NOT EXISTS city VARCHAR(80);
    `);

    // Where the *roaster* was when they generated this roast — this is what
    // scopes the discovery feeds ("people roasted near you"), not where the
    // roasted profile lives, which we have no way of knowing.
    await pool.query(`
      ALTER TABLE ai_responses ADD COLUMN IF NOT EXISTS roaster_country VARCHAR(4);
      ALTER TABLE ai_responses ADD COLUMN IF NOT EXISTS roaster_region  VARCHAR(80);
      ALTER TABLE ai_responses ADD COLUMN IF NOT EXISTS roaster_city    VARCHAR(80);
    `);
    await pool.query(`
      ALTER TABLE roast_jobs ADD COLUMN IF NOT EXISTS roaster_country VARCHAR(4);
      ALTER TABLE roast_jobs ADD COLUMN IF NOT EXISTS roaster_region  VARCHAR(80);
      ALTER TABLE roast_jobs ADD COLUMN IF NOT EXISTS roaster_city    VARCHAR(80);
    `);
    // A re-roast deliberately ignores the cached roast for this profile and
    // generates a fresh one; without this flag the worker would just hand back
    // the roast that already exists.
    await pool.query(`
      ALTER TABLE roast_jobs ADD COLUMN IF NOT EXISTS force_regenerate BOOLEAN NOT NULL DEFAULT false;
    `);
    // Drives the recent-roasts ticker (newest first) and its geo-scoped variants.
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_responses_created ON ai_responses (created_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_responses_geo
        ON ai_responses (roaster_country, roaster_region, roaster_city);
    `);

    // Community rating of a profile's roast — one vote per person per profile,
    // updatable. `voter_key` is the session id where one exists and 'ip:<addr>'
    // otherwise, because visitors in unmonetized regions never get a session row
    // but still get to vote.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roast_ratings (
        id             SERIAL PRIMARY KEY,
        profile_id     INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        ai_response_id INTEGER REFERENCES ai_responses(id) ON DELETE SET NULL,
        session_id     UUID,
        ip_address     VARCHAR(45) NOT NULL,
        voter_key      TEXT NOT NULL,
        rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        voter_country  VARCHAR(4),
        voter_region   VARCHAR(80),
        voter_city     VARCHAR(80),
        created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (profile_id, voter_key)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_roast_ratings_profile ON roast_ratings (profile_id);
    `);

    // Who looked at a roast, for the "most roasted today" board. Counting
    // ai_responses instead wouldn't work: roasts are cached, so a profile only
    // ever gets one row no matter how many people read it.
    //
    // Deliberately one row per (profile, viewer, hour) rather than per request —
    // the page re-requests its roast on every load, so a per-request row would
    // let anyone rank themselves #1 by holding refresh. Rows are pruned after
    // PROFILE_VIEW_RETENTION_DAYS; only the recent window is ever queried.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profile_views (
        id             BIGSERIAL PRIMARY KEY,
        profile_id     INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        viewer_country VARCHAR(4),
        viewer_region  VARCHAR(80),
        viewer_city    VARCHAR(80),
        created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Added after the table shipped counting raw requests. `view_hour` is stored
    // rather than derived because date_trunc over a timestamptz depends on the
    // session TimeZone and so can't be indexed.
    await pool.query(`
      ALTER TABLE profile_views ADD COLUMN IF NOT EXISTS viewer_key TEXT;
      ALTER TABLE profile_views ADD COLUMN IF NOT EXISTS view_hour TIMESTAMP WITH TIME ZONE;
    `);
    // Rows written before those columns existed carry no viewer identity. They
    // collapse into a single 'legacy' viewer per profile per hour rather than
    // each counting as its own person, which is what inflated the early counts.
    await pool.query(`
      UPDATE profile_views
      SET viewer_key = COALESCE(viewer_key, 'legacy'),
          view_hour  = COALESCE(view_hour, date_trunc('hour', created_at))
      WHERE viewer_key IS NULL OR view_hour IS NULL;
    `);
    // The unique index below can't be created while duplicates exist.
    await pool.query(`
      DELETE FROM profile_views a
      USING profile_views b
      WHERE a.id > b.id
        AND a.profile_id = b.profile_id
        AND a.viewer_key = b.viewer_key
        AND a.view_hour  = b.view_hour;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_unique
        ON profile_views (profile_id, viewer_key, view_hour);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_profile_views_recent ON profile_views (created_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_profile_views_geo
        ON profile_views (viewer_country, viewer_region, viewer_city);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_orders (
        id                   SERIAL PRIMARY KEY,
        session_id           UUID NOT NULL REFERENCES roast_sessions(id) ON DELETE CASCADE,
        razorpay_order_id    VARCHAR(64) UNIQUE NOT NULL,
        razorpay_payment_id  VARCHAR(64),
        amount               INTEGER NOT NULL,
        currency             VARCHAR(10) NOT NULL,
        credits_granted      INTEGER NOT NULL DEFAULT 2,
        status               VARCHAR(20) NOT NULL DEFAULT 'created'
                               CHECK (status IN ('created','paid','failed')),
        created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_orders_session ON payment_orders (session_id);
    `);
    // Added when PayPal joined Razorpay: which gateway an order belongs to,
    // with each gateway's ids in its own columns. `razorpay_order_id` loses its
    // NOT NULL (PayPal rows leave it empty); its UNIQUE constraint is fine with
    // multiple NULLs.
    await pool.query(`
      ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS gateway VARCHAR(16) NOT NULL DEFAULT 'razorpay';
      ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS paypal_order_id VARCHAR(64);
      ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS paypal_capture_id VARCHAR(64);
      ALTER TABLE payment_orders ALTER COLUMN razorpay_order_id DROP NOT NULL;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_paypal_order ON payment_orders (paypal_order_id);
    `);
    // One-time backfill for PayPal rows created before the dedicated columns
    // existed (their order id landed in razorpay_order_id). Idempotent — after
    // the first run no row matches.
    await pool.query(`
      UPDATE payment_orders
      SET paypal_order_id = razorpay_order_id,
          paypal_capture_id = razorpay_payment_id,
          razorpay_order_id = NULL,
          razorpay_payment_id = NULL
      WHERE gateway = 'paypal' AND paypal_order_id IS NULL AND razorpay_order_id IS NOT NULL;
    `);

    // Records which roasts a session has already paid for, so re-opening or
    // refreshing a roast you've already unlocked doesn't charge you again.
    // Without this every page load spends a credit — including the automatic
    // retry that fires right after checkout.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_unlocks (
        session_id  UUID NOT NULL REFERENCES roast_sessions(id) ON DELETE CASCADE,
        roast_key   TEXT NOT NULL,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, roast_key)
      );
    `);

    // Requeue anything left stranded in 'processing' by an instance that died mid-job
    // (deploy rollover, crash) — no long-lived background process to rely on completing cleanly.
    await pool.query(`
      UPDATE roast_jobs SET status = 'queued', locked_by = NULL
      WHERE status = 'processing' AND locked_at < now() - interval '5 minutes';
    `);
  } catch (err) {
    logger.critical("Failed to connect to the database", { error: err.message });
  }
}

async function getAIResponse(username, language) {
  try {
    const result = await pool.query(
      // A profile can accumulate several roasts per language (re-roasts,
      // reprocessed jobs) — newest wins, and without the ORDER BY the row
      // Postgres happens to return first isn't deterministic.
      `SELECT ar.response_text
             FROM ai_responses ar
             JOIN profiles p ON ar.profile_id = p.id
             WHERE p.username = $1 and ar.language = $2
             ORDER BY ar.created_at DESC
             LIMIT 1;`,
      [username, language]
    );
    return result.rows[0]; // Returns the first matching row
  } catch (error) {
    logger.error("Error fetching AI response", { error: error.message });
    throw error;
  }
}

const checkCompatibilityResponse = async (profileId1, profileId2, language) => {
  try {
    // Query the database to find the compatibility response
    const result = await pool.query(
      `
      SELECT cm.compatibility_text
      FROM compatibility_responses cm
      WHERE
       ( (cm.profile_id_1 = $1 AND cm.profile_id_2 = $2) OR (cm.profile_id_1 = $2 AND cm.profile_id_2 = $1))
        AND cm.language = $3
      ORDER BY cm.created_at DESC
      LIMIT 1
      `,
      [profileId1, profileId2, language]
    );

    // Return the result if found
    if (result.rows.length > 0) {
      return {
        success: true,
        compatibilityText: result.rows[0].compatibility_text,
      };
    } else {
      return {
        success: false,
        message:
          "No compatibility response found for the given IDs and language.",
      };
    }
  } catch (error) {
    // Handle errors
    logger.error("Error checking compatibility response", { error: error.message });
    return {
      success: false,
      message: "An error occurred while checking compatibility.",
    };
  }
};

async function addUser(
  profilePicUrl,
  username,
  fullName,
  follower,
  following,
  biography,
  post
) {
  try {
    const result = await pool.query(
      `INSERT INTO profiles
                (profile_pic_url, username, full_name, follower, following, biography, post)
             VALUES
                ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (username) DO UPDATE SET
                profile_pic_url = EXCLUDED.profile_pic_url,
                full_name = EXCLUDED.full_name,
                follower = EXCLUDED.follower,
                following = EXCLUDED.following,
                biography = EXCLUDED.biography,
                post = EXCLUDED.post
             RETURNING *;`,
      [profilePicUrl, username, fullName, follower, following, biography, post]
    );

    logger.info("User added successfully", { username });
    return result.rows[0];
  } catch (error) {
    logger.error("Error adding user", { username, error: error.message });
    throw error;
  }
}
async function checkUserExists(username) {
  try {
    const result = await pool.query(
      `SELECT * FROM profiles WHERE username = $1;`,
      [username]
    );

    if (result.rows.length > 0) {
      logger.debug("User exists in DB", { username });
      return true;
    } else {
      logger.debug("User not found in DB", { username });
      return false;
    }
  } catch (error) {
    logger.error("Error checking user existence", { username, error: error.message });
    throw error;
  }
}
// `roasterGeo` records where the person who asked for this roast was, so the
// discovery feeds can scope to a visitor's city/region/country later.
async function addAIResponse(username, responseText, language, roasterGeo = {}) {
  try {
    // Step 1: Get the profile ID for the given username
    const profileResult = await pool.query(
      `SELECT id FROM profiles WHERE username = $1;`,
      [username]
    );

    if (profileResult.rows.length === 0) {
      throw new Error("User not found: Unable to add AI response.");
    }

    const profileId = profileResult.rows[0].id;
    const { country = null, region = null, city = null } = roasterGeo || {};

    // Step 2: Insert AI response into the ai_responses table
    const insertResult = await pool.query(
      `INSERT INTO ai_responses (profile_id, response_text, language, roaster_country, roaster_region, roaster_city)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *;`,
      [profileId, responseText, language, country, region, city]
    );

    logger.info("AI response added successfully");
    return insertResult.rows[0]; // Return the inserted row
  } catch (error) {
    logger.error("Error adding AI response", { error: error.message });
    throw error;
  }
}
// Adding Compatibility Response
async function addCompatiblityResponse(
  username1,
  username2,
  compatiblityText,
  language
) {
  try {
    // Step 1: Get the profile ID for the given username
    const profileResult1 = await pool.query(
      `SELECT id FROM profiles WHERE username = $1;`,
      [username1]
    );
    const profileResult2 = await pool.query(
      `SELECT id FROM profiles WHERE username = $1;`,
      [username2]
    );
    if (profileResult1.rows.length === 0 || profileResult2.rows.length === 0) {
      throw new Error("User not found: Unable to add AI response.");
    }

    const profileId1 = profileResult1.rows[0].id;
    const profileId2 = profileResult2.rows[0].id;

    // Step 2: Insert AI response into the ai_responses table
    const insertResult = await pool.query(
      `INSERT INTO compatibility_responses (profile_id_1,profile_id_2, compatibility_text,language)
             VALUES ($1, $2, $3,$4)
             RETURNING *;`,
      [profileId1, profileId2, compatiblityText, language]
    );

    logger.info("AI response added successfully");
    return insertResult.rows[0]; // Return the inserted row
  } catch (error) {
    logger.error("Error adding AI response", { error: error.message });
    throw error;
  }
}
async function profilesRoasted() {
  try {
    // Assuming you are using a PostgreSQL client like 'pg'
    const result = await pool.query(
      "SELECT COUNT(*) AS count FROM profiles;"
    );
    const count = result.rows[0].count; // Extract the count value
    logger.debug("Profiles roasted count", { count });
    return parseInt(count, 10);
  } catch (error) {
    logger.error("Error counting profiles", { error: error.message });
    throw error; // Rethrow the error to handle it further up the call chain
  }
}

module.exports = {
  pool,
  dbConnect,
  addUser,
  checkUserExists,
  getAIResponse,
  addAIResponse,
  getUserData,
  profilesRoasted,
  addCompatiblityResponse,
  checkCompatibilityResponse,
};
