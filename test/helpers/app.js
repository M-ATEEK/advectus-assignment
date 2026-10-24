import { createApp } from "../../app.js";
import { sequelize } from "../../models/index.js";

/** Recreates every table on the test database (NODE_ENV=test selects advectus_test). */
export const resetDatabase = () => sequelize.sync({ force: true });
export const closeDatabase = () => sequelize.close();

/** A queue double that records what the API would have enqueued and enforces BullMQ's custom-id rule. */
export const createFakeQueue = () => {
  const added = [];
  return {
    added,
    add: async (name, data, opts) => {
      if (opts?.jobId?.includes(":")) throw new Error("Custom Id cannot contain :");
      added.push({ name, data, opts });
      return { id: opts?.jobId ?? String(added.length) };
    },
  };
};

export const startTestApp = async (overrides = {}) => {
  const queue = overrides.queue ?? createFakeQueue();
  const server = createApp({ ...overrides, queue }).listen(0);
  await new Promise((r) => server.once("listening", r));
  return { server, queue, baseUrl: `http://127.0.0.1:${server.address().port}/api/v1` };
};

export const stopTestApp = (server) => new Promise((r) => server.close(r));
