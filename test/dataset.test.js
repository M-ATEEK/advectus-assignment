import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { loadDatasetJob } from "../jobs/loadDatasetJob.js";
import { Company, DatasetVersion } from "../models/index.js";
import { normalizeName } from "../domain/names.js";
import { closeDatabase, resetDatabase, startTestApp, stopTestApp } from "./helpers/app.js";

const ZIP_V1 = new URL("./fixtures/ytj/dump-mini.zip", import.meta.url).pathname;
const ZIP_V2 = new URL("./fixtures/ytj/dump-mini-v2.zip", import.meta.url).pathname;
const silentLog = { info() {}, warn() {}, error() {}, debug() {} };
const load = (path) => loadDatasetJob.handle({ source: "file", path, minRecords: 1 }, { log: silentLog });
let server, baseUrl, queue;

before(async () => {
  await resetDatabase();
  ({ server, baseUrl, queue } = await startTestApp());
});
after(async () => {
  await stopTestApp(server);
  await closeDatabase();
});

test("normalizeName folds case, diacritics and punctuation", () => {
  assert.equal(normalizeName(" Wärtsilä Finland Oy "), "wartsila finland oy");
  assert.equal(normalizeName("Nokian Tili- ja Kiinteistötoimisto Oy"), "nokian tili ja kiinteistotoimisto oy");
});

test("first load: every record upserted, version live, names folded for lookup", async () => {
  const result = await load(ZIP_V1);
  assert.equal(result.status, "live");
  assert.equal(result.recordCount, 8);

  const version = await DatasetVersion.findByPk(result.versionId);
  assert.equal(version.fileName, "data_20261023.json");
  assert.equal(version.generatedAt, "2026-10-23");
  assert.match(version.sha256, /^[0-9a-f]{64}$/);

  const nokia = await Company.findByPk("0112038-9");
  assert.equal(nokia.name, "Nokia Oyj");
  assert.equal(nokia.nameNorm, "nokia oyj");
  assert.ok(nokia.altNamesNorm.includes("nokia corporation"));
  assert.equal(nokia.active, true);
  assert.equal(nokia.source, "dump");
  assert.equal(nokia.datasetVersionId, version.id);
  assert.equal(nokia.data.companyForm.en, "Public limited company");
  assert.equal(new Date(nokia.fetchedAt).toISOString().slice(0, 10), "2026-10-23");

  const bankrupt = await Company.findByPk("0184443-2");
  assert.equal(bankrupt.active, false);
  assert.equal(await Company.count(), 8);
});

test("same file again → unchanged, nothing rewritten", async () => {
  const before = await Company.findByPk("0112038-9");
  const result = await load(ZIP_V1);
  assert.equal(result.status, "unchanged");
  const after = await Company.findByPk("0112038-9");
  assert.equal(after.datasetVersionId, before.datasetVersionId);
  assert.equal((await DatasetVersion.count({ where: { status: "live" } })), 1);
});

test("new file: rows upserted, missing dump rows deleted, API rows kept, old version superseded", async () => {
  await Company.create({
    businessId: "9999999-9", name: "Api Fetched Oy", nameNorm: "api fetched oy", active: true,
    data: { businessId: "9999999-9" }, source: "api", fetchedAt: new Date(),
  });
  const liveBefore = await DatasetVersion.findOne({ where: { status: "live" } });

  const result = await load(ZIP_V2);
  assert.equal(result.status, "live");
  assert.equal(result.recordCount, 7);
  assert.equal(result.deleted, 1, "the liquidation company is not in v2");
  assert.equal(await Company.findByPk("0184215-4"), null);
  assert.ok(await Company.findByPk("9999999-9"), "API-sourced rows survive a dump reload");
  assert.equal((await DatasetVersion.findByPk(liveBefore.id)).status, "superseded");
  assert.equal((await DatasetVersion.findOne({ where: { status: "live" } })).generatedAt, "2026-10-24");
});

test("a dataset file too small for the expected record count is rejected before any row is written", async () => {
  const before = await Company.count();
  await assert.rejects(
    () => loadDatasetJob.handle({ source: "file", path: ZIP_V1, minRecords: 100 }, { log: silentLog }), // v1 differs from the live v2
    (err) => err.code === "DATASET_FILE_TOO_SMALL",
  );
  const failed = await DatasetVersion.findOne({ where: { status: "failed" }, order: [["id", "DESC"]] });
  assert.match(failed.error, /too small to hold 100 records/);
  assert.equal(await Company.count(), before, "nothing written");
  assert.equal((await DatasetVersion.findOne({ where: { status: "live" } })).generatedAt, "2026-10-24", "live version untouched");
});

test("a broken zip fails cleanly", async () => {
  await assert.rejects(() => load(new URL("./fixtures/ytj/nokia-api.json", import.meta.url).pathname), (err) => err.code === "DATASET_ZIP_INVALID");
});

test("GET /dataset reports the live version and freshness; POST /dataset/refresh queues a load", async () => {
  const status = await (await fetch(`${baseUrl}/dataset`)).json();
  assert.equal(status.data.live.generatedAt, "2026-10-24");
  assert.equal(status.data.live.recordCount, 7);
  assert.equal(status.data.companies, 8);
  assert.equal(typeof status.data.stale, "boolean");
  assert.equal(status.data.loading, null);

  const res = await fetch(`${baseUrl}/dataset/refresh`, { method: "POST" });
  assert.equal(res.status, 202);
  assert.equal(queue.added.at(-1).name, "load-dataset");
  assert.deepEqual(queue.added.at(-1).data, { source: "url" });
});
