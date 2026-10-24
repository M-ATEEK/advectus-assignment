import { DataTypes } from "sequelize";
import { JOB_STATUS } from "../../constants/jobs.js";

export const up = async ({ context: { queryInterface } }) => {
  await queryInterface.createTable("jobs", {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    upload_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "uploads", key: "id" },
      onDelete: "RESTRICT",
    },
    status: { type: DataTypes.ENUM(...Object.values(JOB_STATUS)), allowNull: false, defaultValue: JOB_STATUS.QUEUED },
    total_rows: { type: DataTypes.INTEGER, allowNull: true },
    counters: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    format: { type: DataTypes.JSONB, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: true },
    finished_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex("jobs", ["upload_id"]);
  await queryInterface.addIndex("jobs", ["status"]);
};

export const down = async ({ context: { queryInterface, sequelize } }) => {
  await queryInterface.dropTable("jobs", {}); // options object required: Sequelize drops the ENUM type too
  await sequelize.query('DROP TYPE IF EXISTS "enum_jobs_status"');
};
