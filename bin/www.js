#!/usr/bin/env node
import http from "node:http";
import config from "../config/index.js";
import { logger } from "../config/logger.js";
import { createApp } from "../app.js";

const app = createApp();
const server = http.createServer(app);

server.listen(config.port, config.host, () => {
  logger.info({ port: config.port, host: config.host, env: config.env }, "server started");
});

server.on("error", (error) => {
  if (error.syscall !== "listen") throw error;
  const reason = { EACCES: "requires elevated privileges", EADDRINUSE: "is already in use" }[error.code];
  if (!reason) throw error;
  logger.fatal(`port ${config.port} ${reason}`);
  process.exit(1);
});

const shutdown = (signal) => {
  logger.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
