import express from "express";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { logger } from "./config/logger.js";
import { corsMiddleware } from "./config/cors.js";
import { mountRoutes } from "./router.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import config from "./config/index.js";
import { createUploadService } from "./services/uploads.js";

export const createApp = (overrides = {}) => {
  const app = express();
  const deps = {
    uploads: overrides.uploads ?? createUploadService(config.uploads),
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

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
