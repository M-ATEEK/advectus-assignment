import healthRouter from "./routes/health.js";

// Every feature router is mounted here under a single versioned prefix (skeleton convention).
export const mountRoutes = (app) => {
  app.use("/api/v1", [healthRouter]);
};
