import config from "../config/index.js";
import { DATASET_STATUS, JOB_NAMES } from "../constants/jobs.js";
import { Company, DatasetVersion } from "../models/index.js";

export const createDatasetService = ({ queue }) => {
  const status = async () => {
    const [live, loading, companies] = await Promise.all([
      DatasetVersion.findOne({ where: { status: DATASET_STATUS.LIVE } }),
      DatasetVersion.findOne({ where: { status: DATASET_STATUS.LOADING }, order: [["startedAt", "DESC"]] }),
      Company.count(),
    ]);
    const ageHours = live ? (Date.now() - new Date(live.generatedAt ?? live.finishedAt).getTime()) / 3_600_000 : null;
    return {
      live: live ? live.get({ plain: true }) : null,
      loading: loading ? loading.get({ plain: true }) : null,
      companies,
      stale: live ? ageHours > config.dataset.maxAgeHours : true,
      ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      maxAgeHours: config.dataset.maxAgeHours,
    };
  };

  /** Queues a refresh from PRH. One refresh at a time is enforced by the job itself. */
  const requestRefresh = async () => {
    const job = await queue.add(JOB_NAMES.LOAD_DATASET, { source: "url" }, { jobId: `${JOB_NAMES.LOAD_DATASET}-${Date.now()}` });
    return { queueJobId: job.id };
  };

  return { status, requestRefresh };
};
