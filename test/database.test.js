import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sequelize, Upload, Job, JobRow } from "../models/index.js";
import { migrator, seeder } from "../database/umzug.js";

before(async () => {
  await sequelize.getQueryInterface().dropAllTables();
  await sequelize.query('DROP TYPE IF EXISTS "enum_jobs_status"; DROP TYPE IF EXISTS "enum_job_rows_status";');
});
after(() => sequelize.close());

test("migrations apply from scratch and the models fit the migrated schema", async () => {
  const applied = await migrator.up();
  assert.deepEqual(
    applied.map((m) => m.name),
    ["2026.10.24T00.00.01.create-uploads.js", "2026.10.24T00.00.02.create-jobs.js", "2026.10.24T00.00.03.create-job-rows.js"],
  );
  assert.equal((await migrator.pending()).length, 0);

  // Round-trip through the models proves column names and types match the migrations.
  const upload = await Upload.create({ bytes: 10, sha256: "a".repeat(64), path: "/tmp/x.csv" });
  const job = await Job.create({ uploadId: upload.id });
  await JobRow.create({ jobId: job.id, rowNumber: 1, line: 2, input: { businessId: null, name: "Nokia" } });
  const loaded = await Job.findByPk(job.id, { include: ["upload", "rows"] });
  assert.equal(loaded.upload.id, upload.id);
  assert.equal(loaded.rows.length, 1);
  assert.equal(loaded.status, "queued");
  assert.equal(loaded.rows[0].status, "pending");
});

test("seeder creates the demo upload and is reversible", async () => {
  await seeder.up();
  const demo = await Upload.findByPk("11111111-1111-4111-8111-111111111111");
  assert.equal(demo.fileName, "sample-companies.csv");
  assert.equal(demo.bytes, 668);
  await seeder.down({ to: 0 });
  assert.equal(await Upload.findByPk("11111111-1111-4111-8111-111111111111"), null);
});

test("migrations roll back cleanly", async () => {
  await migrator.down({ to: 0 });
  assert.equal((await migrator.executed()).length, 0);
  assert.equal((await sequelize.getQueryInterface().showAllTables()).filter((t) => t !== "sequelize_meta" && t !== "sequelize_seeders").length, 0);
});
