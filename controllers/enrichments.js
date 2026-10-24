import { MESSAGES } from "../constants/messages.js";
import { sendAccepted, sendSuccess } from "../utils/apiResponse.js";

const toJobDto = ({ id, uploadId, status, totalRows, counters, format, error, startedAt, finishedAt, createdAt, updatedAt }) => ({
  id,
  uploadId,
  status,
  totalRows,
  counters,
  format,
  error,
  startedAt,
  finishedAt,
  createdAt,
  updatedAt,
});

const toRowDto = ({ rowNumber, line, input, status, result, error }) => ({ rowNumber, line, input, status, result, error });

const links = (req, id) => ({
  self: `${req.baseUrl}/enrichments/${id}`,
  rows: `${req.baseUrl}/enrichments/${id}/rows`,
});

export const createEnrichmentController = ({ enrichments }) => ({
  /** POST /enrichments { uploadId } — create a job and queue the CSV split. */
  create: async (req, res) => {
    const job = await enrichments.create({ uploadId: req.validated.uploadId });
    req.log.info({ jobId: job.id, uploadId: job.uploadId }, "enrichment job queued");
    return sendAccepted(res, {
      message: MESSAGES.ENRICHMENT_QUEUED,
      data: { job: toJobDto(job), links: links(req, job.id) },
      headers: { Location: links(req, job.id).self },
    });
  },

  /** GET /enrichments/:id — status and counters. */
  get: async (req, res) => {
    const job = await enrichments.get(req.validated.id);
    return sendSuccess(res, { message: MESSAGES.ENRICHMENT_FETCHED, data: { job: toJobDto(job), links: links(req, job.id) } });
  },

  /** GET /enrichments/:id/results?status=&page=&limit= — normalized companies + customer records per row. */
  listResults: async (req, res) => {
    const { id, status, page = 1, limit = 1000 } = req.validated;
    const job = await enrichments.get(id);
    const { results, pagination } = await enrichments.listResults(id, { status, page, limit });
    return sendSuccess(res, {
      message: MESSAGES.ENRICHMENT_RESULTS_FETCHED,
      data: { job: toJobDto(job), results },
      meta: { pagination },
    });
  },

  /** GET /enrichments/:id/rows?status=&page=&limit= — stored rows, paginated. */
  listRows: async (req, res) => {
    const { id, status, page = 1, limit = 100 } = req.validated;
    const { rows, pagination } = await enrichments.listRows(id, { status, page, limit });
    return sendSuccess(res, { message: MESSAGES.ENRICHMENT_ROWS_FETCHED, data: { rows: rows.map(toRowDto) }, meta: { pagination } });
  },
});
