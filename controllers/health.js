import { readFile } from "node:fs/promises";
import { MESSAGES } from "../constants/messages.js";
import { sendSuccess } from "../utils/apiResponse.js";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

export const health = async (_req, res) =>
  // Component checks (postgres, redis, dataset age, breaker) are added as those components arrive.
  sendSuccess(res, {
    message: MESSAGES.HEALTH_OK,
    data: {
      status: "ok",
      service: pkg.name,
      version: pkg.version,
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
