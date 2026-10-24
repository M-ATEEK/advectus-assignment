import { Op } from "sequelize";
import { JOB_NAMES, ROW_STATUS } from "../constants/jobs.js";
import { JobRow } from "../models/index.js";
import { resolveRow } from "../services/resolveRow.js";

/** Same key inside one chunk → one lookup. Cheap and keeps the job code free of caching concerns. */
const memoize = (fn) => {
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) cache.set(key, fn(key));
    return cache.get(key);
  };
};

/**
 * Resolves the rows of one chunk: { jobId, from, to } processes queued rows with from <= rowNumber <= to;
 * { jobId, retryPending: true } re-resolves rows left pending by an earlier PRH outage.
 * The chunk that finds no queued rows left enqueues finalize-job (finalize is idempotent, so duplicates are harmless).
 */
export const resolveRowsJob = {
  name: JOB_NAMES.RESOLVE_ROWS,

  async handle({ jobId, from, to, retryPending = false }, { log, queue, lookup }) {
    const where = retryPending
      ? { jobId, status: ROW_STATUS.PENDING }
      : { jobId, status: ROW_STATUS.QUEUED, rowNumber: { [Op.between]: [from, to] } };
    const rows = await JobRow.findAll({ where, order: [["rowNumber", "ASC"]] });

    const cached = {
      findByBusinessId: memoize((id) => lookup.findByBusinessId(id)),
      findByName: memoize((name) => lookup.findByName(name)),
    };

    const counts = {};
    for (const row of rows) {
      const outcome = await resolveRow(row.input, cached);
      await row.update({ status: outcome.status, result: outcome.result ?? null, error: outcome.error ?? null });
      counts[outcome.status] = (counts[outcome.status] ?? 0) + 1;
    }

    const queuedLeft = await JobRow.count({ where: { jobId, status: ROW_STATUS.QUEUED } });
    if (queuedLeft === 0) await queue.add(JOB_NAMES.FINALIZE_JOB, { jobId }, { jobId: `${JOB_NAMES.FINALIZE_JOB}-${jobId}-${Date.now()}` });

    log.info({ rows: rows.length, counts, queuedLeft }, "chunk resolved");
    return { rows: rows.length, counts };
  },
};
