import { readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

export const health = async (_req, res) => {
  // Component checks (postgres, redis, dataset age, breaker) are added as those components arrive.
  res.json({
    status: "ok",
    service: pkg.name,
    version: pkg.version,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};
