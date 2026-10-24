export const JOB_STATUS = Object.freeze({
  QUEUED: "queued", // created, waiting for a worker
  SPLITTING: "splitting", // reading the CSV into job_rows
  READY: "ready", // rows stored, waiting for enrichment chunks
  RUNNING: "running", // chunks being resolved
  DONE: "done",
  PARTIAL: "partial", // finished with rows still pending (PRH unavailable)
  FAILED: "failed",
});

export const ROW_STATUS = Object.freeze({
  PENDING: "pending",
  MATCHED: "matched",
  AMBIGUOUS: "ambiguous",
  NOT_FOUND: "not_found",
  INVALID: "invalid", // nothing usable to look up
  ERROR: "error",
});

export const QUEUE_NAME = "enrichment";

export const JOB_NAMES = Object.freeze({
  SPLIT_CSV: "split-csv",
});
