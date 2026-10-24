import { splitCsvJob } from "./splitCsvJob.js";

/** Registry of every job the worker can run, keyed by BullMQ job name. */
export const jobs = Object.fromEntries([splitCsvJob].map((job) => [job.name, job]));
