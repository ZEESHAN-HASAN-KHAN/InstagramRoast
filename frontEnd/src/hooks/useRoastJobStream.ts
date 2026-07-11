import { useCallback, useEffect, useRef, useState } from "react";

type JobStatus = "idle" | "queued" | "progress" | "done" | "failed" | "cancelled";

interface RoastJobState<TResult> {
  status: JobStatus;
  stage: string | null;
  stageMessage: string | null;
  // Fields of the final result that are already known before the job is done
  // (e.g. the scraped profile, ahead of the roast text itself) — merged in as
  // progress events carry them, so the UI can render pieces as they arrive.
  partial: Partial<TResult> | null;
  result: TResult | null;
  error: string | null;
  // True when the enqueue endpoint answered with the full result immediately
  // (already roasted before) — the UI skips the staged loading animation.
  cached: boolean;
}

// The enqueue endpoint answers one of two ways: `done: true` for a fully
// cached result (answered synchronously, no queue/SSE needed), or `done: false`
// with a jobId/streamToken to open the SSE stream against for real work.
type EnqueueResponse<TResult> =
  | { done: true; result: TResult }
  | { done: false; jobId: string; streamToken: string };

const IDLE_STATE = {
  status: "idle" as const,
  stage: null,
  stageMessage: null,
  partial: null,
  result: null,
  error: null,
  cached: false,
};

// Shared plumbing for the queue+SSE roast flow: call `start` with a function that
// POSTs to the enqueue endpoint, then this hook opens the SSE stream for the
// returned job and updates state as progress/done/failed/cancelled events arrive.
// On unmount it closes the connection and fires a cancel beacon so an abandoned
// job doesn't keep running server-side for nobody.
export function useRoastJobStream<TResult>() {
  const [state, setState] = useState<RoastJobState<TResult>>(IDLE_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);
  const jobRef = useRef<{ jobId: string; streamToken: string; apiUrl: string } | null>(null);
  // Bumped on every start() call and on unmount so a stale in-flight enqueue
  // can't setState after it no longer applies.
  const requestIdRef = useRef(0);

  const closeStream = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    const job = jobRef.current;
    if (!job) return;
    navigator.sendBeacon(
      `${job.apiUrl}/api/v1/roastStream/${job.jobId}/cancel?token=${encodeURIComponent(job.streamToken)}`
    );
  }, []);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately reading the live counter, not a stale snapshot
      requestIdRef.current++;
      cancel();
      closeStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(
    async (enqueue: () => Promise<EnqueueResponse<TResult>>, apiUrl: string) => {
      const requestId = ++requestIdRef.current;
      const isStale = () => requestIdRef.current !== requestId;

      cancel();
      closeStream();
      setState(IDLE_STATE);
      setState((prev) => ({ ...prev, status: "queued" }));

      try {
        const response = await enqueue();
        if (isStale()) return;

        if (response.done) {
          // Fully cached — this person was already roasted. Skip the staged
          // loading animation entirely and show the result immediately.
          setState((prev) => ({ ...prev, status: "done", result: response.result, cached: true }));
          return;
        }

        const { jobId, streamToken } = response;
        jobRef.current = { jobId, streamToken, apiUrl };

        const es = new EventSource(
          `${apiUrl}/api/v1/roastStream/${jobId}?token=${encodeURIComponent(streamToken)}`
        );
        eventSourceRef.current = es;

        es.addEventListener("progress", (event: MessageEvent) => {
          const { stage, message, ...partialFields } = JSON.parse(event.data);
          setState((prev) => ({
            ...prev,
            status: "progress",
            stage,
            stageMessage: message,
            partial: Object.keys(partialFields).length ? { ...prev.partial, ...partialFields } : prev.partial,
          }));
        });

        es.addEventListener("done", (event: MessageEvent) => {
          const data = JSON.parse(event.data) as TResult;
          setState((prev) => ({ ...prev, status: "done", result: data }));
          closeStream();
        });

        es.addEventListener("failed", (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          setState((prev) => ({ ...prev, status: "failed", error: data.message || "Something went wrong" }));
          closeStream();
        });

        es.addEventListener("cancelled", () => {
          setState((prev) => ({ ...prev, status: "cancelled" }));
          closeStream();
        });

        es.onerror = () => {
          // EventSource auto-reconnects after transient network hiccups; only
          // treat it as failed once the browser has given up for good.
          if (es.readyState === EventSource.CLOSED) {
            setState((prev) => (prev.status === "done" ? prev : { ...prev, status: "failed", error: "Lost connection while roasting" }));
          }
        };
      } catch (error) {
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: error instanceof Error ? error.message : "Something went wrong",
        }));
      }
    },
    [cancel, closeStream]
  );

  return { ...state, start };
}
