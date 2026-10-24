import { DataTypes } from "sequelize";
import { DATASET_STATUS } from "../../constants/jobs.js";

export const up = async ({ context: { queryInterface } }) => {
  await queryInterface.createTable("dataset_versions", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    status: { type: DataTypes.ENUM(...Object.values(DATASET_STATUS)), allowNull: false, defaultValue: DATASET_STATUS.LOADING },
    source: { type: DataTypes.STRING(1024), allowNull: false },
    file_name: { type: DataTypes.STRING(255), allowNull: true },
    sha256: { type: DataTypes.CHAR(64), allowNull: true },
    generated_at: { type: DataTypes.DATEONLY, allowNull: true },
    record_count: { type: DataTypes.INTEGER, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: false },
    finished_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex("dataset_versions", ["status"]);
};

export const down = async ({ context: { queryInterface } }) => {
  await queryInterface.dropTable("dataset_versions", {}); // options object required: Sequelize drops the ENUM type too
};
