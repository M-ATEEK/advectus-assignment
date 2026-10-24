import { sequelize } from "../config/database.js";
import { Upload, initUpload } from "./Upload.js";
import { Job, initJob } from "./Job.js";
import { JobRow, initJobRow } from "./JobRow.js";

initUpload(sequelize);
initJob(sequelize);
initJobRow(sequelize);

const models = { Upload, Job, JobRow };
for (const model of Object.values(models)) model.associate?.(models);

export { sequelize, Upload, Job, JobRow };
