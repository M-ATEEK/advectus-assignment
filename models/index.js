import { sequelize } from "../config/database.js";
import { Upload, initUpload } from "./Upload.js";
import { Job, initJob } from "./Job.js";
import { JobRow, initJobRow } from "./JobRow.js";
import { DatasetVersion, initDatasetVersion } from "./DatasetVersion.js";
import { Company, initCompany } from "./Company.js";

initUpload(sequelize);
initJob(sequelize);
initJobRow(sequelize);
initDatasetVersion(sequelize);
initCompany(sequelize);

const models = { Upload, Job, JobRow, DatasetVersion, Company };
for (const model of Object.values(models)) model.associate?.(models);

export { sequelize, Upload, Job, JobRow, DatasetVersion, Company };
