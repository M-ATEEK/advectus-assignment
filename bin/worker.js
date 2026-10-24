#!/usr/bin/env node
import { Worker } from "bullmq";
import config from "../config/index.js";
import { logger } from "../config/logger.js";
import { QUEUE_NAME } from "../constants/jobs.js";
import { sequelize } from "../models/index.js";
import { jobs } from "../jobs/index.js";
import { createQueue, createRedisConnection } from "../jobs/queue.js";
import { JOB_NAMES } from "../constants/jobs.js";

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const definition = jobs[job.name];
    if (!definition) throw new Error(`No handler registered for job "${job.name}"`);
    return definition.handle(job.data, { log: logger.child({ queueJobId: job.id, job: job.name, ...job.data }) });
  },
  { connection: createRedisConnection(), concurrency: config.queue.concurrency },
);

// Daily register refresh (BullMQ job scheduler: one repeatable definition, upserted on every start).
const queue = createQueue();
await queue.upsertJobScheduler(
  "daily-dataset-refresh",
  { pattern: config.dataset.cron, tz: config.dataset.timezone },
  { name: JOB_NAMES.LOAD_DATASET, data: { source: "url" } },
);

worker.on("ready", () => logger.info({ queue: QUEUE_NAME, concurrency: config.queue.concurrency, datasetCron: config.dataset.cron }, "worker ready"));
worker.on("completed", (job) => logger.info({ queueJobId: job.id, job: job.name }, "job completed"));
worker.on("failed", (job, err) => logger.error({ queueJobId: job?.id, job: job?.name, err }, "job failed"));
worker.on("error", (err) => logger.error({ err }, "worker error"));

const shutdown = async (signal) => {
  logger.info({ signal }, "worker shutting down");
  await worker.close();
  await queue.close();
  await sequelize.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
