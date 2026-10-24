import { DataTypes } from "sequelize";
import { ROW_STATUS } from "../../constants/jobs.js";

export const up = async ({ context: { queryInterface } }) => {
  await queryInterface.createTable("job_rows", {
    job_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "jobs", key: "id" },
      onDelete: "CASCADE",
    },
    row_number: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    line: { type: DataTypes.INTEGER, allowNull: false },
    input: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.ENUM(...Object.values(ROW_STATUS)), allowNull: false, defaultValue: ROW_STATUS.PENDING },
    result: { type: DataTypes.JSONB, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
  });
  await queryInterface.addIndex("job_rows", ["job_id", "status"]);
};

export const down = async ({ context: { queryInterface, sequelize } }) => {
  await queryInterface.dropTable("job_rows", {}); // options object required: Sequelize drops the ENUM type too
  await sequelize.query('DROP TYPE IF EXISTS "enum_job_rows_status"');
};
