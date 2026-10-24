import { DataTypes, Model } from "sequelize";
import { JOB_STATUS } from "../constants/jobs.js";

export class Job extends Model {
  static associate({ Upload, JobRow }) {
    Job.belongsTo(Upload, { foreignKey: "uploadId", as: "upload" });
    Job.hasMany(JobRow, { foreignKey: "jobId", as: "rows" });
  }
}

export const initJob = (sequelize) =>
  Job.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      uploadId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.ENUM(...Object.values(JOB_STATUS)), allowNull: false, defaultValue: JOB_STATUS.QUEUED },
      totalRows: { type: DataTypes.INTEGER, allowNull: true },
      counters: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      format: { type: DataTypes.JSONB, allowNull: true }, // delimiter, header, column mapping as detected
      error: { type: DataTypes.TEXT, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "jobs" },
  );
