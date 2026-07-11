const express = require("express");
const roastStreamRouter = express.Router();
const logger = require("../helpers/logger");
const { verifyStreamToken } = require("../helpers/streamToken");
const {
  getRoastJob,
  claimRoastJob,
  updateRoastJobProgress,
  completeRoastJob,
  failRoastJob,
  cancelRoastJob,
  requestCancelRoastJob,
  requeueStaleJobs,
} = require("../database/roastJobs");
const { publishJobUpdate, subscribeToJob } = require("../database/pubsub");
const { acquire: acquireSlot } = require("../worker/concurrencyLimiter");
const { processSingleRoastJob } = require("../worker/processSingleRoastJob");
const { processCompatibilityRoastJob } = require("../worker/processCompatibilityRoastJob");

const TERMINAL_STATUSES = ["done", "failed", "cancelled"];

roastStreamRouter.get("/roastStream/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { token } = req.query;

  if (!verifyStreamToken(token, jobId)) {
    return res.status(401).json({ message: "Invalid or expired stream token" });
  }

  requeueStaleJobs(); // opportunistic backstop, not awaited on the hot path

  const job = await getRoastJob(jobId);
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  let closed = false;
  let unsubscribe = null;
  let releaseSlot = null;
  let isProcessingHandler = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearInterval(pollFallback);
    if (unsubscribe) unsubscribe();
    if (releaseSlot) releaseSlot();
  };

  const sendEvent = (event, data) => {
    if (closed) return;
    res.write(`id: ${Date.now()}\n`);
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Dedupe by row identity so the poll fallback below doesn't re-send an
  // unchanged state every tick — it only matters when something changed.
  let lastEmittedKey = null;

  const emitJobState = (row) => {
    if (!row || closed) return;
    const key = `${row.status}:${row.stage}:${new Date(row.updated_at).getTime()}`;
    if (key === lastEmittedKey) return;
    lastEmittedKey = key;

    if (row.status === "done") sendEvent("done", row.result);
    else if (row.status === "failed") sendEvent("failed", { message: row.error_message || "Something went wrong" });
    else if (row.status === "cancelled") sendEvent("cancelled", {});
    // `result` may already hold partial data (e.g. the scraped profile) even
    // though the job isn't done yet — ride it along so the frontend can show
    // it as soon as it exists instead of waiting for the terminal event.
    else sendEvent("progress", { stage: row.stage, message: row.stage_message, ...(row.result || {}) });

    if (TERMINAL_STATUSES.includes(row.status)) {
      cleanup();
      res.end();
    }
  };

  const heartbeat = setInterval(() => {
    if (!closed) res.write(": heartbeat\n\n");
  }, 15000);

  // LISTEN/NOTIFY should deliver updates near-instantly, but some managed
  // Postgres setups (e.g. a connection pooler in transaction-pooling mode)
  // silently swallow notifications — LISTEN and NOTIFY both succeed with no
  // error, but nothing is ever delivered back. This poll is the fallback that
  // makes the stream converge regardless of whether NOTIFY actually works.
  const pollFallback = setInterval(async () => {
    if (closed) return;
    try {
      emitJobState(await getRoastJob(jobId));
    } catch (error) {
      logger.error("Poll fallback failed to read job state", { jobId, error: error.message });
    }
  }, 2000);

  req.on("close", () => {
    // Only the connection actually processing this job cancels it on disconnect —
    // a second observing tab closing shouldn't kill work another open tab awaits.
    if (isProcessingHandler) requestCancelRoastJob(jobId).catch(() => {});
    cleanup();
  });

  emitJobState(job);
  if (closed) return;

  // The notify payload carries the full row snapshot itself (see pubsub.js) —
  // no re-fetch here, so a burst of fast transitions can't race a DB round-trip
  // and skip straight to a later state.
  unsubscribe = subscribeToJob(jobId, (payload) => {
    if (closed) return;
    emitJobState(payload);
  });

  const claimed = await claimRoastJob(jobId, `${process.pid}`);
  if (!claimed || closed) return;

  isProcessingHandler = true;
  const queuedRow = await updateRoastJobProgress(jobId, {
    stage: "queued_for_processing",
    stageIndex: 0,
    totalStages: 0,
    stageMessage: "waiting for a processing slot...",
  });
  publishJobUpdate(jobId, queuedRow).catch(() => {});

  releaseSlot = await acquireSlot();
  if (closed) {
    releaseSlot();
    releaseSlot = null;
    return;
  }

  const onProgress = async (stage, message, partialResult = null) => {
    const row = await updateRoastJobProgress(jobId, { stage, stageIndex: 0, totalStages: 0, stageMessage: message, partialResult });
    await publishJobUpdate(jobId, row);
  };

  try {
    const dispatch = claimed.job_type === "single" ? processSingleRoastJob : processCompatibilityRoastJob;
    const result = await dispatch(claimed, { onProgress });
    const doneRow = await completeRoastJob(jobId, result);
    await publishJobUpdate(jobId, doneRow);
  } catch (error) {
    if (error.cancelled) {
      const cancelledRow = await cancelRoastJob(jobId);
      await publishJobUpdate(jobId, cancelledRow);
    } else {
      logger.error("Roast job processing failed", { jobId, error: error.message, stack: error.stack });
      const failedRow = await failRoastJob(jobId, error.message);
      await publishJobUpdate(jobId, failedRow);
    }
  }
});

roastStreamRouter.post("/roastStream/:jobId/cancel", async (req, res) => {
  const { jobId } = req.params;
  const { token } = req.query;

  if (!verifyStreamToken(token, jobId)) {
    return res.status(401).end();
  }

  await requestCancelRoastJob(jobId);
  return res.status(204).end();
});

module.exports = roastStreamRouter;
