import express from "express";
import { existsSync } from "node:fs";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { logger } from "./config/logger.js";
import { corsMiddleware } from "./config/cors.js";
import { mountRoutes } from "./router.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import config from "./config/index.js";
import { createUploadService } from "./services/uploads.js";
import { createInspectService } from "./services/inspect.js";
import { createEnrichmentService } from "./services/enrichments.js";
import { createDatasetService } from "./services/dataset.js";
import { createQueue } from "./jobs/queue.js";

export const createApp = (overrides = {}) => {
  const app = express();
  const uploads = overrides.uploads ?? createUploadService(config.uploads);
  const inspector = overrides.inspector ?? createInspectService();
  const queue = overrides.queue ?? createQueue();
  const deps = {
    uploads,
    inspector,
    queue,
    enrichments: overrides.enrichments ?? createEnrichmentService({ uploads, inspector, queue }),
    dataset: overrides.dataset ?? createDatasetService({ queue }),
  };

  app.disable("x-powered-by");
  app.disable("etag");

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers["x-request-id"] ?? randomUUID(),
      autoLogging: { ignore: (req) => req.url.endsWith("/health") },
    }),
  );
  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  mountRoutes(app, deps);

  // The React page, when built (npm run web:build). In development Vite serves it on :5173 and proxies /api here.
  const webDist = new URL("./web/dist", import.meta.url).pathname;
  if (existsSync(webDist)) app.use(express.static(webDist));

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
