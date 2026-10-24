import { DataTypes, Model } from "sequelize";

export class Upload extends Model {
  static associate({ Job }) {
    Upload.hasMany(Job, { foreignKey: "uploadId", as: "jobs" });
  }
}

export const initUpload = (sequelize) =>
  Upload.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      fileName: { type: DataTypes.STRING(255), allowNull: true },
      contentType: { type: DataTypes.STRING(100), allowNull: true },
      bytes: { type: DataTypes.BIGINT, allowNull: false, get() { return Number(this.getDataValue("bytes")); } },
      sha256: { type: DataTypes.CHAR(64), allowNull: false },
      path: { type: DataTypes.STRING(1024), allowNull: false }, // server-side only, never serialised to clients
      receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, tableName: "uploads" },
  );
