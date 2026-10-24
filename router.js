import healthRouter from "./routes/health.js";
import { createUploadsRouter } from "./routes/uploads.js";
import { createEnrichmentsRouter } from "./routes/enrichments.js";
import { createDatasetRouter } from "./routes/dataset.js";

// Every feature router is mounted here under a single versioned prefix (skeleton convention).
export const mountRoutes = (app, deps) => {
  app.use("/api/v1", [healthRouter, createUploadsRouter(deps), createEnrichmentsRouter(deps), createDatasetRouter(deps)]);
};
