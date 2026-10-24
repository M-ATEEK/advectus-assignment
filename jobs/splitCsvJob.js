import config from "../config/index.js";
import { JOB_NAMES, JOB_STATUS, ROW_STATUS } from "../constants/jobs.js";
import { Job, JobRow, Upload } from "../models/index.js";
import { readInputRows } from "../services/rowReader.js";

/** A row we can never look up: no name and no (valid) business ID. */
const initialStatus = ({ businessId, name }) => (businessId?.valid || name ? ROW_STATUS.PENDING : ROW_STATUS.INVALID);

const toJobRow = (jobId, row) => ({
  jobId,
  rowNumber: row.rowNumber,
  line: row.line,
  input: {
    businessId: row.businessId
      ? { input: row.businessId.input, normalized: row.businessId.value, valid: row.businessId.valid, reason: row.businessId.reason ?? null }
      : null,
    name: row.name,
  },
  status: initialStatus(row),
});

/**
 * Reads the uploaded CSV once and stores every data row in job_rows.
 * Re-runnable: a retry wipes the rows written by a previous attempt first.
 */
export const splitCsvJob = {
  name: JOB_NAMES.SPLIT_CSV,

  async handle({ jobId }, { log }) {
    const job = await Job.findByPk(jobId, { include: [{ model: Upload, as: "upload" }] });
    if (!job) throw new Error(`Job ${jobId} does not exist`);

    await job.update({ status: JOB_STATUS.SPLITTING, startedAt: new Date(), error: null });
    await JobRow.destroy({ where: { jobId } });

    const counters = { emptyRows: 0, withBusinessId: 0, withName: 0, invalidBusinessIds: 0, invalidRows: 0, pendingRows: 0 };
    let format = null;
    let batch = [];
    let totalRows = 0;

    const flush = async () => {
      if (batch.length === 0) return;
      await JobRow.bulkCreate(batch);
      batch = [];
    };

    try {
      for await (const item of readInputRows(job.upload.path)) {
        if (item.type === "meta") {
          format = { delimiter: item.delimiter, hasBom: item.hasBom, hasHeader: item.hasHeader, columns: item.columns };
          continue;
        }
        if (item.empty) {
          counters.emptyRows++;
          continue;
        }
        totalRows++;
        if (item.businessId) counters.withBusinessId++;
        if (item.name) counters.withName++;
        if (item.businessId && !item.businessId.valid) counters.invalidBusinessIds++;

        const row = toJobRow(jobId, item);
        if (row.status === ROW_STATUS.INVALID) counters.invalidRows++;
        else counters.pendingRows++;

        batch.push(row);
        if (batch.length >= config.pipeline.rowBatchSize) await flush();
      }
      await flush();

      await job.update({ status: JOB_STATUS.READY, totalRows, counters, format });
      log.info({ totalRows, counters }, "csv split into rows");
      return { totalRows, counters };
    } catch (err) {
      await job.update({ status: JOB_STATUS.FAILED, error: err.message, finishedAt: new Date() });
      throw err;
    }
  },
};
