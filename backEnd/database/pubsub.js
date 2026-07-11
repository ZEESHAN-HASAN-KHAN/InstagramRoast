const { Client } = require("pg");
const { EventEmitter } = require("events");
const { pool } = require("./db");
const logger = require("../helpers/logger");

const CHANNEL = "roast_job_updates";

// LISTEN must live on one dedicated, never-pooled connection: a pooled connection
// gets handed back and reused for unrelated queries, which would silently stop
// delivering notifications the moment it's recycled.
let listenClient = null;
const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(0);

async function connectListener() {
  listenClient = new Client({
    connectionString: process.env.DB,
    ssl: { rejectUnauthorized: false },
  });

  listenClient.on("error", (error) => {
    logger.error("roast_job_updates LISTEN connection error, reconnecting", { error: error.message });
    reconnectListener();
  });

  listenClient.on("notification", (msg) => {
    if (msg.channel !== CHANNEL) return;
    try {
      const payload = JSON.parse(msg.payload);
      jobEvents.emit(payload.jobId, payload);
    } catch (error) {
      logger.error("Failed to parse roast_job_updates payload", { error: error.message });
    }
  });

  await listenClient.connect();
  await listenClient.query(`LISTEN ${CHANNEL};`);
  logger.info("Listening for roast_job_updates notifications");
}

function reconnectListener() {
  setTimeout(() => {
    connectListener().catch((error) => {
      logger.error("Failed to reconnect roast_job_updates listener", { error: error.message });
      reconnectListener();
    });
  }, 2000);
}

async function startPubSub() {
  await connectListener();
}

// Carries the actual row snapshot (status/stage/message/partial-or-final result)
// in the NOTIFY payload itself, rather than just a signal that tells the
// subscriber to go re-read the row. An async re-fetch-on-notify was tried first,
// but for a fully-cached job every stage transition can happen within the same
// millisecond — faster than the re-fetch round-trip — so concurrent re-fetches
// would often all land on the row's *final* state, silently skipping the
// intermediate stages the frontend is supposed to show. Sending the snapshot
// directly makes each notification self-contained and ordered.
// Postgres caps NOTIFY payloads at 8000 bytes; this app's roast text is capped
// at ~100 words by the prompt, so a full row snapshot comfortably fits — but
// fall back to dropping `result` if a payload is ever unexpectedly large
// (the periodic poll fallback in the SSE handler will pick up the full result).
async function publishJobUpdate(jobId, row) {
  const snapshot = {
    jobId,
    status: row.status,
    stage: row.stage,
    stage_message: row.stage_message,
    error_message: row.error_message,
    result: row.result,
    updated_at: row.updated_at,
  };

  // Deliver to in-process subscribers directly: the SSE handler that processes
  // a job lives in this same process, and transaction-pooled connections (e.g.
  // Supabase's pooler on :6543) accept LISTEN without error but never deliver
  // notifications — so the local emit is the delivery path that must not depend
  // on Postgres. Subscribers dedupe by (status, stage, updated_at), so a
  // duplicate arriving via NOTIFY below is harmless.
  jobEvents.emit(jobId, snapshot);

  // Cross-instance delivery stays best-effort: a NOTIFY failure must not fail
  // the job whose processing loop awaits this call.
  try {
    let payload = JSON.stringify(snapshot);
    if (Buffer.byteLength(payload) > 7500) {
      payload = JSON.stringify({ ...snapshot, result: null });
    }
    await pool.query(`SELECT pg_notify($1, $2);`, [CHANNEL, payload]);
  } catch (error) {
    logger.error("Failed to publish roast_job_updates notification", { jobId, error: error.message });
  }
}

function subscribeToJob(jobId, handler) {
  jobEvents.on(jobId, handler);
  return () => jobEvents.off(jobId, handler);
}

module.exports = { startPubSub, publishJobUpdate, subscribeToJob };
