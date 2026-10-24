import { splitCsvJob } from "./splitCsvJob.js";
import { loadDatasetJob } from "./loadDatasetJob.js";

/** Registry of every job the worker can run, keyed by BullMQ job name. */
export const jobs = Object.fromEntries([splitCsvJob, loadDatasetJob].map((job) => [job.name, job]));
