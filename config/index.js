import "dotenv/config";

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

  databaseUrl: process.env.DATABASE_URL ?? "postgres://advectus:advectus@localhost:5440/advectus",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6390",

  ytj: {
    baseUrl: process.env.YTJ_BASE_URL ?? "https://avoindata.prh.fi/opendata-ytj-api/v3",
    ratePerSec: int(process.env.YTJ_RATE_PER_SEC, 4),
    timeoutMs: int(process.env.YTJ_TIMEOUT_MS, 10_000),
  },

  pipeline: {
    syncRowLimit: int(process.env.SYNC_ROW_LIMIT, 200),
    chunkSize: int(process.env.CHUNK_SIZE, 1000),
    datasetMaxAgeHours: int(process.env.DATASET_MAX_AGE_H, 24),
    datasetCron: process.env.DATASET_CRON ?? "30 5 * * *",
  },

  uploads: {
    dir: process.env.UPLOAD_DIR ?? "./uploads",
    maxBytes: int(process.env.MAX_UPLOAD_MB, 512) * 1024 * 1024,
    // Sniffed on the first chunk: a CSV is text, so a NUL byte means a binary file was sent.
    sniffBytes: 8 * 1024,
  },
};

export default config;
