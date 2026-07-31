const { pool } = require("./db");
const logger = require("../helpers/logger");

const FREE_ROAST_LIMIT = Number(process.env.FREE_ROAST_LIMIT) || 2;
const IP_FREE_ROAST_LIMIT = Number(process.env.IP_FREE_ROAST_LIMIT) || 5;

// `ipAddress` and the geo columns are only ever written on the INSERT branch — a
// returning visitor keeps whatever was recorded when their session was created,
// so a session's IP can't be re-pointed by roaming onto another network (which
// would otherwise reset its contribution to the per-IP free-usage sum below).
async function getOrCreateSession(id, ipAddress, geo = {}) {
  const { country = null, region = null, city = null } = geo || {};
  const result = await pool.query(
    `INSERT INTO roast_sessions (id, ip_address, country_code, region, city)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET updated_at = now()
     RETURNING *;`,
    [id, ipAddress, country, region, city]
  );
  return result.rows[0];
}

// Spends exactly one roast: a free one if the visitor still has free roasts AND
// their IP hasn't blown through the cross-session free allowance, else a paid
// credit, else nothing. Single statement so two concurrent requests on the same
// session can't both read the same balance and both spend it — same atomic
// `UPDATE ... RETURNING` shape as claimRoastJob().
//
// Returns { granted, type: 'free'|'paid'|null, session }. `session` is the row
// AFTER the update, or the untouched row when nothing was granted.
async function consumeCredit({ sessionId, ipAddress }) {
  const result = await pool.query(
    // `locked` is deliberately a bare SELECT ... FOR UPDATE with no expressions:
    // under READ COMMITTED a concurrent spender blocks here, and once the winner
    // commits Postgres re-reads the updated row version, so the decision below is
    // always made against a post-conflict balance.
    `WITH ip_usage AS (
       SELECT COALESCE(SUM(free_used), 0) AS total
       FROM roast_sessions
       WHERE ip_address = $2 AND id <> $1
     ),
     locked AS (
       SELECT id, free_used, paid_credits
       FROM roast_sessions
       WHERE id = $1
       FOR UPDATE
     ),
     decision AS (
       SELECT
         l.id,
         CASE
           WHEN l.free_used < $3 AND l.free_used + iu.total < $4 THEN 'free'
           WHEN l.paid_credits > 0 THEN 'paid'
           ELSE 'none'
         END AS type
       FROM locked l CROSS JOIN ip_usage iu
     )
     UPDATE roast_sessions rs
     SET free_used    = rs.free_used    + (CASE WHEN d.type = 'free' THEN 1 ELSE 0 END),
         paid_credits = rs.paid_credits - (CASE WHEN d.type = 'paid' THEN 1 ELSE 0 END),
         updated_at   = now()
     FROM decision d
     WHERE rs.id = d.id
     RETURNING rs.*, d.type AS credit_type;`,
    [sessionId, ipAddress, FREE_ROAST_LIMIT, IP_FREE_ROAST_LIMIT]
  );

  const row = result.rows[0];
  if (!row) return { granted: false, type: null, session: null };

  const { credit_type: creditType, ...session } = row;
  return {
    granted: creditType !== "none",
    type: creditType === "none" ? null : creditType,
    session,
  };
}

// Spends one PAID credit and nothing else. Re-roasts never draw on the free
// bucket: the free roasts exist to get someone their first roast, while a
// re-roast is an extra LLM run on a profile they've already seen. Same atomic
// UPDATE ... RETURNING shape as consumeCredit so concurrent re-roast clicks
// can't both spend the same credit.
async function consumePaidCredit(sessionId) {
  const result = await pool.query(
    `WITH locked AS (
       SELECT id, paid_credits
       FROM roast_sessions
       WHERE id = $1
       FOR UPDATE
     )
     UPDATE roast_sessions rs
     SET paid_credits = rs.paid_credits - (CASE WHEN l.paid_credits > 0 THEN 1 ELSE 0 END),
         updated_at   = now()
     FROM locked l
     WHERE rs.id = l.id
     RETURNING rs.*, (l.paid_credits > 0) AS granted;`,
    [sessionId]
  );

  const row = result.rows[0];
  if (!row) return { granted: false, session: null };

  const { granted, ...session } = row;
  return { granted, session };
}

// Identifies a specific roast so a session is only ever charged once for it.
// Compatibility pairs are sorted, so (a,b) and (b,a) are the same unlock.
function buildRoastKey({ jobType, username, username2 = null, language }) {
  if (jobType === "compatibility") {
    const pair = [username, username2].map((u) => String(u).toLowerCase()).sort().join("|");
    return `compat:${pair}:${language}`;
  }
  return `single:${String(username).toLowerCase()}:${language}`;
}

// Claims the right to charge for a roast. Returns true only for the FIRST
// caller with this (session, roast) pair — a repeat view, refresh, or the
// automatic retry after checkout returns false and is served free.
//
// Done as an atomic INSERT ... ON CONFLICT rather than a read-then-write so two
// simultaneous requests for the same roast can't both decide they're first and
// double-charge.
async function claimRoastUnlock(sessionId, roastKey) {
  const result = await pool.query(
    `INSERT INTO session_unlocks (session_id, roast_key)
     VALUES ($1, $2)
     ON CONFLICT (session_id, roast_key) DO NOTHING
     RETURNING session_id;`,
    [sessionId, roastKey]
  );
  return result.rows.length > 0;
}

// Releases a claim so the visitor isn't left "having unlocked" a roast that
// never arrived — otherwise a failed roast would become permanently free.
async function releaseRoastUnlock(sessionId, roastKey) {
  if (!sessionId || !roastKey) return;
  await pool.query(
    `DELETE FROM session_unlocks WHERE session_id = $1 AND roast_key = $2;`,
    [sessionId, roastKey]
  );
}

// Hands back the credit a job consumed, when that job ends without delivering a
// roast (failed, or cancelled before it finished). Idempotent via the
// `credit_refunded = false` guard, so the failure and cancellation paths — and
// any retry of either — can call it freely without over-crediting.
//
// The refund goes back to whichever bucket paid: a free roast restores
// free_used, a paid one restores a credit. GREATEST(...,0) keeps free_used from
// going negative if a refund ever races something unexpected.
async function refundJobCredit(jobId) {
  const result = await pool.query(
    `WITH refunded AS (
       UPDATE roast_jobs
       SET credit_refunded = true, updated_at = now()
       WHERE id = $1
         AND credit_refunded = false
         AND session_id IS NOT NULL
         AND credit_type IN ('free', 'paid')
       RETURNING session_id, credit_type, roast_key
     ),
     released AS (
       -- Drop the unlock too, so a roast that never arrived doesn't stay
       -- permanently free for this session.
       DELETE FROM session_unlocks su
       USING refunded r
       WHERE su.session_id = r.session_id AND su.roast_key = r.roast_key
     )
     UPDATE roast_sessions rs
     SET free_used    = GREATEST(rs.free_used - (CASE WHEN r.credit_type = 'free' THEN 1 ELSE 0 END), 0),
         paid_credits = rs.paid_credits + (CASE WHEN r.credit_type = 'paid' THEN 1 ELSE 0 END),
         updated_at   = now()
     FROM refunded r
     WHERE rs.id = r.session_id
     RETURNING rs.*;`,
    [jobId]
  );
  return result.rows[0] || null;
}

// Sweeps up jobs that were enqueued but never processed (client never opened
// its stream, or died before the cancel beacon fired) and refunds them. Cheap
// and idempotent, so it rides along on the same opportunistic backstop call as
// requeueStaleJobs rather than needing its own timer.
async function expireAndRefundAbandonedJobs() {
  const { expireAbandonedJobs } = require("./roastJobs");
  try {
    const jobIds = await expireAbandonedJobs();
    for (const jobId of jobIds) {
      await refundJobCredit(jobId);
    }
    if (jobIds.length) {
      logger.info("Refunded abandoned roast jobs", { count: jobIds.length });
    }
  } catch (error) {
    logger.error("Failed to refund abandoned roast jobs", { error: error.message });
  }
}

// Direct refund for failures that happen before a job row exists (i.e. the
// enqueue request itself blew up). Not idempotent — only call it on a path that
// runs once, and prefer refundJobCredit whenever a jobId is available.
async function refundSessionCredit(sessionId, creditType) {
  if (creditType !== "free" && creditType !== "paid") return null;
  const result = await pool.query(
    `UPDATE roast_sessions
     SET free_used    = GREATEST(free_used - (CASE WHEN $2 = 'free' THEN 1 ELSE 0 END), 0),
         paid_credits = paid_credits + (CASE WHEN $2 = 'paid' THEN 1 ELSE 0 END),
         updated_at   = now()
     WHERE id = $1
     RETURNING *;`,
    [sessionId, creditType]
  );
  return result.rows[0] || null;
}

// Each gateway keeps its ids in its own columns. Column names are looked up
// from this table — never from caller input — so the string-built queries below
// can't be steered anywhere else.
const GATEWAY_COLUMNS = {
  razorpay: { orderId: "razorpay_order_id", paymentId: "razorpay_payment_id" },
  paypal: { orderId: "paypal_order_id", paymentId: "paypal_capture_id" },
};

function gatewayColumns(gateway) {
  const columns = GATEWAY_COLUMNS[gateway];
  if (!columns) throw new Error(`Unknown payment gateway: ${gateway}`);
  return columns;
}

// `orderId` is the gateway's own order id (Razorpay order_… / PayPal token).
async function createPaymentOrder({
  sessionId,
  orderId,
  amount,
  currency,
  creditsGranted,
  gateway = "razorpay",
}) {
  const columns = gatewayColumns(gateway);
  const result = await pool.query(
    `INSERT INTO payment_orders (session_id, ${columns.orderId}, amount, currency, credits_granted, status, gateway)
     VALUES ($1, $2, $3, $4, $5, 'created', $6)
     RETURNING *;`,
    [sessionId, orderId, amount, currency, creditsGranted, gateway]
  );
  return result.rows[0];
}

async function getPaymentOrder(orderId, gateway = "razorpay") {
  const columns = gatewayColumns(gateway);
  const result = await pool.query(
    `SELECT * FROM payment_orders WHERE ${columns.orderId} = $1;`,
    [orderId]
  );
  return result.rows[0] || null;
}

// Idempotent by construction: the `status = 'created'` guard means a replayed
// webhook (or the webhook racing the client-driven confirm call) matches zero
// rows, the outer UPDATE then matches nothing, and the whole thing is a no-op
// returning null. Both callers can fire this unconditionally. `paymentId` is
// the Razorpay payment id or the PayPal capture id.
async function markOrderPaidAndGrantCredits({ orderId, paymentId, gateway = "razorpay" }) {
  const columns = gatewayColumns(gateway);
  const result = await pool.query(
    `WITH updated_order AS (
       UPDATE payment_orders
       SET status = 'paid', ${columns.paymentId} = $2, updated_at = now()
       WHERE ${columns.orderId} = $1 AND status = 'created'
       RETURNING session_id, credits_granted
     )
     UPDATE roast_sessions rs
     SET paid_credits = rs.paid_credits + uo.credits_granted,
         updated_at = now()
     FROM updated_order uo
     WHERE rs.id = uo.session_id
     RETURNING rs.*;`,
    [orderId, paymentId]
  );
  return result.rows[0] || null;
}

async function getSession(sessionId) {
  const result = await pool.query(`SELECT * FROM roast_sessions WHERE id = $1;`, [sessionId]);
  return result.rows[0] || null;
}

module.exports = {
  FREE_ROAST_LIMIT,
  IP_FREE_ROAST_LIMIT,
  getOrCreateSession,
  getSession,
  consumeCredit,
  consumePaidCredit,
  buildRoastKey,
  claimRoastUnlock,
  releaseRoastUnlock,
  refundJobCredit,
  refundSessionCredit,
  expireAndRefundAbandonedJobs,
  createPaymentOrder,
  getPaymentOrder,
  markOrderPaidAndGrantCredits,
};
