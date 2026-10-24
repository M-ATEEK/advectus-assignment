import { Umzug, SequelizeStorage } from "umzug";
import { sequelize } from "../config/database.js";
import { logger } from "../config/logger.js";

const projectRoot = new URL("..", import.meta.url).pathname;

const create = (glob, modelName) =>
  new Umzug({
    migrations: { glob: [glob, { cwd: projectRoot }] },
    context: { queryInterface: sequelize.getQueryInterface(), sequelize },
    storage: new SequelizeStorage({ sequelize, modelName }),
    logger: logger.child({ component: modelName }),
  });

/** Schema migrations: database/migrations/*.js, tracked in sequelize_meta. */
export const migrator = create("database/migrations/*.js", "sequelize_meta");
/** Data seeders: database/seeders/*.js, tracked in sequelize_seeders. */
export const seeder = create("database/seeders/*.js", "sequelize_seeders");
