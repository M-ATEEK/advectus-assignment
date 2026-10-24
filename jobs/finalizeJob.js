import config from "../config/index.js";
import { JOB_NAMES, JOB_STATUS, ROW_STATUS } from "../constants/jobs.js";
import { Job, JobRow, sequelize } from "../models/index.js";

/** { matched: 12, not_found: 3, ... } with every status present. */
const countByStatus = async (jobId) => {
  const rows = await JobRow.findAll({
    where: { jobId },
    attributes: ["status", [sequelize.fn("COUNT", "*"), "count"]],
    group: ["status"],
    raw: true,
  });
  const counts = Object.fromEntries(Object.values(ROW_STATUS).map((s) => [s, 0]));
  for (const r of rows) counts[r.status] = Number(r.count);
  return counts;
};

/**
 * Closes a job once every row has been resolved: recounts from job_rows (the source of truth), sets done or partial,
 * and schedules a delayed retry while rows are still pending because PRH was unavailable.
 */
export const finalizeJob = {
  name: JOB_NAMES.FINALIZE_JOB,

  async handle({ jobId, attempt = 0 }, { log, queue }) {
    const job = await Job.findByPk(jobId);
    if (!job) throw new Error(`Job ${jobId} does not exist`);

    const counts = await countByStatus(jobId);
    if (counts.queued > 0) {
      log.info({ queued: counts.queued }, "finalize skipped: rows still queued");
      return { status: job.status, counts };
    }

    const { retryPendingDelayMs, retryPendingMaxAttempts } = config.pipeline;
    const canRetry = counts.pending > 0 && attempt < retryPendingMaxAttempts;
    const status = counts.pending > 0 ? JOB_STATUS.PARTIAL : JOB_STATUS.DONE;
    await job.update({ status, counters: { ...job.counters, rows: counts, retryAttempt: attempt }, finishedAt: new Date() });

    if (canRetry) {
      const delay = Math.min(retryPendingDelayMs * 2 ** attempt, 6 * 60 * 60 * 1000);
      await queue.add(JOB_NAMES.RESOLVE_ROWS, { jobId, retryPending: true }, { delay, jobId: `${JOB_NAMES.RESOLVE_ROWS}-retry-${jobId}-${attempt + 1}` });
      await queue.add(JOB_NAMES.FINALIZE_JOB, { jobId, attempt: attempt + 1 }, { delay: delay + 60_000, jobId: `${JOB_NAMES.FINALIZE_JOB}-${jobId}-retry-${attempt + 1}` });
      log.info({ pending: counts.pending, delayMs: delay, attempt: attempt + 1 }, "retry scheduled for pending rows");
    }

    log.info({ status, counts }, "job finalized");
    return { status, counts };
  },
};
