import cors from "cors";
import config from "./index.js";

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow same-origin / server-to-server calls (no Origin header) and listed origins.
    if (!origin || config.allowOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
