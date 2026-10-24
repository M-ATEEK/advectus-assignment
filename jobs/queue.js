import { Queue } from "bullmq";
import IORedis from "ioredis";
import config from "../config/index.js";
import { QUEUE_NAME } from "../constants/jobs.js";

export const createRedisConnection = () => new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

/** The producer side: the API adds jobs here, workers (bin/worker.js) consume them. */
export const createQueue = () =>
  new Queue(QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 1_000 },
      removeOnFail: { count: 5_000 },
    },
  });
