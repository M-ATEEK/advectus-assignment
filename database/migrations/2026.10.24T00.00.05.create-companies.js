import { DataTypes } from "sequelize";
import { COMPANY_SOURCE } from "../../constants/jobs.js";

export const up = async ({ context: { queryInterface } }) => {
  await queryInterface.createTable("companies", {
    business_id: { type: DataTypes.STRING(9), primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: true },
    name_norm: { type: DataTypes.STRING(255), allowNull: true },
    alt_names_norm: { type: DataTypes.ARRAY(DataTypes.STRING(255)), allowNull: false, defaultValue: [] },
    active: { type: DataTypes.BOOLEAN, allowNull: false },
    data: { type: DataTypes.JSONB, allowNull: false },
    source: { type: DataTypes.ENUM(...Object.values(COMPANY_SOURCE)), allowNull: false },
    dataset_version_id: { type: DataTypes.INTEGER, allowNull: true },
    fetched_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex("companies", ["name_norm"]); // exact name match
  await queryInterface.addIndex("companies", ["alt_names_norm"], { using: "gin" }); // exact match on parallel/auxiliary names
  await queryInterface.addIndex("companies", ["dataset_version_id"]);
};

export const down = async ({ context: { queryInterface } }) => {
  await queryInterface.dropTable("companies", {}); // options object required: Sequelize drops the ENUM type too
};
