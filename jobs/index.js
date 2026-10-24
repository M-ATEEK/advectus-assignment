import { splitCsvJob } from "./splitCsvJob.js";
import { loadDatasetJob } from "./loadDatasetJob.js";
import { resolveRowsJob } from "./resolveRowsJob.js";
import { finalizeJob } from "./finalizeJob.js";

/** Registry of every job the worker can run, keyed by BullMQ job name. */
export const jobs = Object.fromEntries([splitCsvJob, loadDatasetJob, resolveRowsJob, finalizeJob].map((job) => [job.name, job]));
