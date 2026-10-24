import { DataTypes } from "sequelize";

export const up = async ({ context: { queryInterface } }) => {
  await queryInterface.createTable("uploads", {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    file_name: { type: DataTypes.STRING(255), allowNull: true },
    content_type: { type: DataTypes.STRING(100), allowNull: true },
    bytes: { type: DataTypes.BIGINT, allowNull: false },
    sha256: { type: DataTypes.CHAR(64), allowNull: false },
    path: { type: DataTypes.STRING(1024), allowNull: false },
    received_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
};

export const down = async ({ context: { queryInterface } }) => {
  await queryInterface.dropTable("uploads");
};
