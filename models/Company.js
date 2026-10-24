import { DataTypes, Model } from "sequelize";
import { COMPANY_SOURCE } from "../constants/jobs.js";

/** The local copy of the PRH register: one normalised company per business ID. */
export class Company extends Model {}

export const initCompany = (sequelize) =>
  Company.init(
    {
      businessId: { type: DataTypes.STRING(9), primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: true },
      nameNorm: { type: DataTypes.STRING(255), allowNull: true }, // normalizeName(name), for exact and fuzzy lookups
      altNamesNorm: { type: DataTypes.ARRAY(DataTypes.STRING(255)), allowNull: false, defaultValue: [] },
      active: { type: DataTypes.BOOLEAN, allowNull: false },
      data: { type: DataTypes.JSONB, allowNull: false }, // NormalizedCompany
      source: { type: DataTypes.ENUM(...Object.values(COMPANY_SOURCE)), allowNull: false },
      datasetVersionId: { type: DataTypes.INTEGER, allowNull: true }, // null for API-fetched rows
      fetchedAt: { type: DataTypes.DATE, allowNull: false }, // dump generation date or API call time
    },
    { sequelize, tableName: "companies", timestamps: false },
  );
