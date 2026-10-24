#!/usr/bin/env node
/**
 * Load the PRH register without the queue:
 *   node bin/dataset.js load --file docs/all_companies_20261023.zip   (a ZIP you already have)
 *   node bin/dataset.js load                                          (download from PRH)
 */
import { parseArgs } from "node:util";
import { logger } from "../config/logger.js";
import { sequelize } from "../models/index.js";
import { loadDatasetJob } from "../jobs/loadDatasetJob.js";

const { positionals, values } = parseArgs({ allowPositionals: true, options: { file: { type: "string" } } });
if (positionals[0] !== "load") {
  logger.error("Usage: node bin/dataset.js load [--file <zip>]");
  process.exit(1);
}

try {
  const result = await loadDatasetJob.handle(values.file ? { source: "file", path: values.file } : { source: "url" }, { log: logger });
  logger.info(result, "dataset load finished");
} catch (err) {
  logger.error({ err }, "dataset load failed");
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
