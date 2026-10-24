import "dotenv/config";
import { tmpdir } from "node:os";
import path from "node:path";

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isNaN(n) ? fallback : n;
};

const list = (value, fallback = []) =>
  value ? value.split(",").map((s) => s.trim()).filter(Boolean) : fallback;

const config = {
  env: process.env.NODE_ENV ?? "development",
  port: int(process.env.PORT, 8000),
  host: process.env.HOST ?? "0.0.0.0",
  logLevel: process.env.LOG_LEVEL ?? "info",
  allowOrigins: list(process.env.ALLOW_ORIGINS, ["http://localhost:3000", "http://localhost:5173"]),

  databaseUrl:
    process.env.NODE_ENV === "test"
      ? process.env.DATABASE_URL_TEST ?? "postgres://advectus:advectus@localhost:5440/advectus_test"
      : process.env.DATABASE_URL ?? "postgres://advectus:advectus@localhost:5440/advectus",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6390",

  queue: {
    concurrency: int(process.env.QUEUE_CONCURRENCY, 2),
  },

  ytj: {
    baseUrl: process.env.YTJ_BASE_URL ?? "https://avoindata.prh.fi/opendata-ytj-api/v3",
    ratePerSec: int(process.env.YTJ_RATE_PER_SEC, 4),
    timeoutMs: int(process.env.YTJ_TIMEOUT_MS, 10_000),
    retries: int(process.env.YTJ_RETRIES, 2),
  },

  dataset: {
    url: process.env.DATASET_URL ?? `${process.env.YTJ_BASE_URL ?? "https://avoindata.prh.fi/opendata-ytj-api/v3"}/all_companies`,
    dir: process.env.DATASET_DIR ?? (process.env.NODE_ENV === "test" ? path.join(tmpdir(), "advectus-test-dumps") : "./data/dumps"),
    minRecords: int(process.env.DATASET_MIN_RECORDS, 400_000), // the real register has ~465k companies
    maxAgeHours: int(process.env.DATASET_MAX_AGE_H, 24),
    cron: process.env.DATASET_CRON ?? "30 5 * * *", // PRH generates the dump around 04:36
    timezone: process.env.DATASET_TZ ?? "Europe/Helsinki",
  },

  pipeline: {
    syncRowLimit: int(process.env.SYNC_ROW_LIMIT, 200),
    chunkSize: int(process.env.CHUNK_SIZE, 1000),
    rowBatchSize: int(process.env.ROW_BATCH_SIZE, 1000),
    usabilityScanRows: int(process.env.USABILITY_SCAN_ROWS, 200),
    retryPendingDelayMs: int(process.env.RETRY_PENDING_DELAY_MS, 5 * 60 * 1000),
    retryPendingMaxAttempts: int(process.env.RETRY_PENDING_MAX_ATTEMPTS, 10),
  },

  customer: {
    // Register-specific constants stamped on every exported customer record.
    subsidiary: process.env.CUSTOMER_SUBSIDIARY ?? "FI",
    currency: process.env.CUSTOMER_CURRENCY ?? "EUR",
  },

  uploads: {
    // Tests get their own directory so seeders and fixtures never touch development uploads.
    dir: process.env.UPLOAD_DIR ?? (process.env.NODE_ENV === "test" ? path.join(tmpdir(), "advectus-test-uploads") : "./uploads"),
    maxBytes: int(process.env.MAX_UPLOAD_MB, 512) * 1024 * 1024,
    // Sniffed on the first chunk: a CSV is text, so a NUL byte means a binary file was sent.
    sniffBytes: 8 * 1024,
  },
};

export default config;
