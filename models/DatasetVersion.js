import { DataTypes, Model } from "sequelize";
import { DATASET_STATUS } from "../constants/jobs.js";

/** One row per attempt to load the PRH register; exactly one is `live` at a time. */
export class DatasetVersion extends Model {}

export const initDatasetVersion = (sequelize) =>
  DatasetVersion.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      status: { type: DataTypes.ENUM(...Object.values(DATASET_STATUS)), allowNull: false, defaultValue: DATASET_STATUS.LOADING },
      source: { type: DataTypes.STRING(1024), allowNull: false }, // URL or local file path
      fileName: { type: DataTypes.STRING(255), allowNull: true }, // entry inside the ZIP, e.g. data_20261023.json
      sha256: { type: DataTypes.CHAR(64), allowNull: true },
      generatedAt: { type: DataTypes.DATEONLY, allowNull: true }, // date in the entry name
      recordCount: { type: DataTypes.INTEGER, allowNull: true },
      error: { type: DataTypes.TEXT, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "dataset_versions" },
  );
