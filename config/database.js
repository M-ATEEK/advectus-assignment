import { Sequelize } from "sequelize";
import config from "./index.js";
import { logger } from "./logger.js";

/** One Sequelize instance per process. Models register themselves on it in models/index.js. */
export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: "postgres",
  logging: (sql) => logger.trace({ sql }, "sql"),
  define: { underscored: true, timestamps: true },
  pool: { max: 10, min: 0, idle: 10_000 },
});
