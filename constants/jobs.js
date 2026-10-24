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
  QUEUED: "queued", // stored, waiting for a resolve-rows chunk
  PENDING: "pending", // looked up, but PRH was unavailable and nothing local existed; retried later
  MATCHED: "matched",
  AMBIGUOUS: "ambiguous",
  NOT_FOUND: "not_found",
  INVALID: "invalid", // nothing usable to look up
  ERROR: "error",
});

export const QUEUE_NAME = "enrichment";

export const JOB_NAMES = Object.freeze({
  SPLIT_CSV: "split-csv",
  LOAD_DATASET: "load-dataset",
  RESOLVE_ROWS: "resolve-rows",
  FINALIZE_JOB: "finalize-job",
});

export const MATCH_CONFIDENCE = Object.freeze({ BUSINESS_ID: "business-id", NAME_EXACT: "name-exact" });

export const ROW_WARNING = Object.freeze({
  INVALID_BUSINESS_ID: "INVALID_BUSINESS_ID", // checksum/format failed; matched by name instead
  ID_NOT_FOUND_USED_NAME: "ID_NOT_FOUND_USED_NAME",
  NAME_MISMATCH: "NAME_MISMATCH", // matched by id, but the CSV name is not one of the company's current names
  PRH_UNAVAILABLE: "PRH_UNAVAILABLE",
});

export const DATASET_STATUS = Object.freeze({
  LOADING: "loading",
  LIVE: "live",
  UNCHANGED: "unchanged", // same file as the live version, nothing loaded
  SUPERSEDED: "superseded",
  FAILED: "failed",
});

export const COMPANY_SOURCE = Object.freeze({ DUMP: "dump", API: "api" });
