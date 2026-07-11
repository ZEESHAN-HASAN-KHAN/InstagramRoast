const { v4: uuidv4 } = require("uuid");
const { pool } = require("./db");
const logger = require("../helpers/logger");

async function createRoastJob({ jobType, username, username2 = null, language }) {
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO roast_jobs (id, job_type, username, username_2, language, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     RETURNING *;`,
    [id, jobType, username, username2, language]
  );
  return result.rows[0];
}

async function getRoastJob(jobId) {
  const result = await pool.query(`SELECT * FROM roast_jobs WHERE id = $1;`, [jobId]);
  return result.rows[0] || null;
}

// Atomically claims a specific queued job for this worker. Returns the claimed
// row, or null if it was already claimed/finished by another connection/instance.
async function claimRoastJob(jobId, workerId) {
  const result = await pool.query(
    `UPDATE roast_jobs
     SET status = 'processing', locked_by = $2, locked_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'queued'
     RETURNING *;`,
    [jobId, workerId]
  );
  return result.rows[0] || null;
}

// `partialResult` (e.g. the scraped profile, before the roast text exists) is
// merged into the job's `result` column so it survives reconnects and rides
// along on the next progress push — the frontend can render it immediately
// instead of waiting for the terminal 'done' event.
async function updateRoastJobProgress(jobId, { stage, stageIndex, totalStages, stageMessage, partialResult = null }) {
  const result = await pool.query(
    `UPDATE roast_jobs
     SET stage = $2, stage_index = $3, total_stages = $4, stage_message = $5,
         result = CASE WHEN $6::jsonb IS NOT NULL THEN COALESCE(result, '{}'::jsonb) || $6::jsonb ELSE result END,
         updated_at = now()
     WHERE id = $1
     RETURNING *;`,
    [jobId, stage, stageIndex, totalStages, stageMessage, partialResult ? JSON.stringify(partialResult) : null]
  );
  return result.rows[0] || null;
}

async function completeRoastJob(jobId, result) {
  const dbResult = await pool.query(
    `UPDATE roast_jobs
     SET status = 'done', result = $2, updated_at = now()
     WHERE id = $1
     RETURNING *;`,
    [jobId, result]
  );
  return dbResult.rows[0] || null;
}

async function failRoastJob(jobId, errorMessage) {
  const result = await pool.query(
    `UPDATE roast_jobs
     SET status = 'failed', error_message = $2, updated_at = now()
     WHERE id = $1
     RETURNING *;`,
    [jobId, errorMessage]
  );
  return result.rows[0] || null;
}

async function cancelRoastJob(jobId) {
  const result = await pool.query(
    `UPDATE roast_jobs
     SET status = 'cancelled', updated_at = now()
     WHERE id = $1
     RETURNING *;`,
    [jobId]
  );
  return result.rows[0] || null;
}

async function requestCancelRoastJob(jobId) {
  await pool.query(
    `UPDATE roast_jobs
     SET cancellation_requested = true, updated_at = now()
     WHERE id = $1 AND status IN ('queued', 'processing');`,
    [jobId]
  );
}

async function isCancellationRequested(jobId) {
  const result = await pool.query(
    `SELECT cancellation_requested FROM roast_jobs WHERE id = $1;`,
    [jobId]
  );
  return result.rows[0]?.cancellation_requested === true;
}

// Opportunistic backstop: requeue jobs stranded in 'processing' because the SSE
// connection that was processing them died uncleanly. Cheap enough to run inline
// on any new POST/SSE-connect request rather than needing a dedicated timer.
async function requeueStaleJobs() {
  try {
    await pool.query(
      `UPDATE roast_jobs SET status = 'queued', locked_by = NULL
       WHERE status = 'processing' AND locked_at < now() - interval '5 minutes';`
    );
  } catch (error) {
    logger.error("Error requeuing stale roast jobs", { error: error.message });
  }
}

module.exports = {
  createRoastJob,
  getRoastJob,
  claimRoastJob,
  updateRoastJobProgress,
  completeRoastJob,
  failRoastJob,
  cancelRoastJob,
  requestCancelRoastJob,
  isCancellationRequested,
  requeueStaleJobs,
};
