#!/usr/bin/env node
/**
 * Database CLI:  node bin/db.js <migrate|migrate:undo|migrate:status|seed|seed:undo|reset>
 */
import { sequelize } from "../models/index.js";
import { migrator, seeder } from "../database/umzug.js";
import config from "../config/index.js";
import { logger } from "../config/logger.js";

const commands = {
  migrate: () => migrator.up(),
  "migrate:undo": () => migrator.down(),
  "migrate:status": async () => {
    const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()]);
    return { executed: executed.map((m) => m.name), pending: pending.map((m) => m.name) };
  },
  seed: () => seeder.up(),
  "seed:undo": () => seeder.down(),
  reset: async () => {
    if (config.env === "production") throw new Error("reset is disabled in production");
    await seeder.down({ to: 0 });
    await migrator.down({ to: 0 });
    await migrator.up();
    return seeder.up();
  },
};

const command = commands[process.argv[2]];
if (!command) {
  logger.error(`Usage: node bin/db.js <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}

try {
  const result = await command();
  logger.info({ result: Array.isArray(result) ? result.map((m) => m.name) : result }, `db ${process.argv[2]} done`);
} catch (err) {
  logger.error({ err }, `db ${process.argv[2]} failed`);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
