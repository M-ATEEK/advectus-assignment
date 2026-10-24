import { DataTypes, Model } from "sequelize";
import { ROW_STATUS } from "../constants/jobs.js";

export class JobRow extends Model {
  static associate({ Job }) {
    JobRow.belongsTo(Job, { foreignKey: "jobId", as: "job" });
  }
}

export const initJobRow = (sequelize) =>
  JobRow.init(
    {
      jobId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      rowNumber: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true }, // 1-based, data rows only
      line: { type: DataTypes.INTEGER, allowNull: false }, // physical line in the CSV, for error reports
      input: { type: DataTypes.JSONB, allowNull: false }, // { businessId: {input, normalized, valid, reason} | null, name }
      status: { type: DataTypes.ENUM(...Object.values(ROW_STATUS)), allowNull: false, defaultValue: ROW_STATUS.QUEUED },
      result: { type: DataTypes.JSONB, allowNull: true }, // company + customer + provenance once enriched
      error: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: "job_rows", timestamps: false, indexes: [{ fields: ["job_id", "status"] }] },
  );
