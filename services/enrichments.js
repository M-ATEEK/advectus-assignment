import config from "../config/index.js";
import { ApiError } from "../utils/ApiError.js";
import { ERRORS } from "../constants/messages.js";
import { JOB_NAMES, JOB_STATUS } from "../constants/jobs.js";
import { Job, JobRow } from "../models/index.js";

export const createEnrichmentService = ({ uploads, inspector, queue }) => {
  /** Creates a job for an upload and queues the CSV split. Rejects files inspection cannot make sense of. */
  const create = async ({ uploadId }) => {
    const upload = await uploads.find(uploadId);
    if (!upload) throw ApiError.from(ERRORS.UPLOAD_NOT_FOUND, { params: { id: uploadId } });

    const inspection = await inspector.inspect(upload.path, { maxRows: config.pipeline.usabilityScanRows, sampleSize: 0 });
    if (!inspection.usable) {
      throw ApiError.from(ERRORS.UPLOAD_NOT_USABLE, {
        params: { reasons: inspection.warnings.map((w) => w.message).join(" ") },
        details: inspection.warnings,
      });
    }

    const job = await Job.create({ uploadId });
    try {
      // BullMQ custom ids must not contain ":"; one deterministic id per job makes re-submission idempotent.
      await queue.add(JOB_NAMES.SPLIT_CSV, { jobId: job.id }, { jobId: `${JOB_NAMES.SPLIT_CSV}-${job.id}` });
    } catch (err) {
      await job.update({ status: JOB_STATUS.FAILED, error: `Could not enqueue: ${err.message}`, finishedAt: new Date() });
      throw err;
    }
    return job.get({ plain: true });
  };

  const get = async (id) => {
    const job = await Job.findByPk(id);
    if (!job) throw ApiError.from(ERRORS.ENRICHMENT_NOT_FOUND, { params: { id } });
    return job.get({ plain: true });
  };

  const listRows = async (id, { status, page, limit }) => {
    await get(id);
    const where = { jobId: id, ...(status ? { status } : {}) };
    const { rows, count } = await JobRow.findAndCountAll({
      where,
      order: [["rowNumber", "ASC"]],
      offset: (page - 1) * limit,
      limit,
      raw: true,
    });
    return { rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } };
  };

  /** Rows with their result flattened: what a client consumes after the job is done. */
  const listResults = async (id, { status, page, limit }) => {
    const { rows, pagination } = await listRows(id, { status, page, limit });
    const results = rows.map(({ rowNumber, line, input, status: rowStatus, result, error }) => ({
      rowNumber,
      line,
      input,
      status: rowStatus,
      confidence: result?.confidence ?? null,
      warnings: result?.warnings ?? [],
      company: result?.company ?? null, // normalized PRH data
      customer: result?.customer ?? null, // customer-register record
      candidates: result?.candidates ?? null, // only for ambiguous rows
      error,
    }));
    return { results, pagination };
  };

  return { create, get, listRows, listResults };
};
