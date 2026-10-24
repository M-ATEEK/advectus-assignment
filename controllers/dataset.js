import { MESSAGES } from "../constants/messages.js";
import { sendAccepted, sendSuccess } from "../utils/apiResponse.js";

const toVersionDto = (v) =>
  v && { id: v.id, status: v.status, fileName: v.fileName, generatedAt: v.generatedAt, recordCount: v.recordCount, startedAt: v.startedAt, finishedAt: v.finishedAt, error: v.error };

export const createDatasetController = ({ dataset }) => ({
  /** GET /dataset — which register version is live, how old it is, whether a load is running. */
  status: async (_req, res) => {
    const s = await dataset.status();
    return sendSuccess(res, {
      message: MESSAGES.DATASET_FETCHED,
      data: { ...s, live: toVersionDto(s.live), loading: toVersionDto(s.loading) },
    });
  },

  /** POST /dataset/refresh — queue a download-and-load from PRH. */
  refresh: async (req, res) => {
    const result = await dataset.requestRefresh();
    req.log.info(result, "dataset refresh queued");
    return sendAccepted(res, { message: MESSAGES.DATASET_REFRESH_QUEUED, data: result });
  },
});
