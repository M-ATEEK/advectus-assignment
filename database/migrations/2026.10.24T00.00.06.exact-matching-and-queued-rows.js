/**
 * Matching is exact-only: drop the trigram index and extension created by an earlier draft of migration 05
 * (no-ops on fresh databases). Rows get a `queued` status to tell "waiting for a chunk" from "pending PRH".
 */
export const up = async ({ context: { sequelize } }) => {
  await sequelize.query("DROP INDEX IF EXISTS companies_name_norm_trgm");
  await sequelize.query("DROP EXTENSION IF EXISTS pg_trgm");
  await sequelize.query(`ALTER TYPE "enum_job_rows_status" ADD VALUE IF NOT EXISTS 'queued' BEFORE 'pending'`);
  await sequelize.query(`ALTER TABLE job_rows ALTER COLUMN status SET DEFAULT 'queued'`);
};

export const down = async () => {
  // PostgreSQL cannot drop a single enum value; the status column simply stops using 'queued'.
};
