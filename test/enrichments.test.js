import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUploadService } from "../services/uploads.js";
import { splitCsvJob } from "../jobs/splitCsvJob.js";
import { Job, JobRow, Upload } from "../models/index.js";
import { closeDatabase, resetDatabase, startTestApp, stopTestApp } from "./helpers/app.js";

const SAMPLE = new URL("../data/sample-companies.csv", import.meta.url);
const silentLog = { info() {}, warn() {}, error() {}, debug() {} };
const ctx = () => ({ log: silentLog, queue: { add: async () => ({}) } });
const CSV_MIN = "business_id;company_name\n0112038-9;Nokia Oyj\n";
let server, baseUrl, dir, queue;

const uploadText = async (text) => {
  const res = await fetch(`${baseUrl}/uploads`, { method: "POST", headers: { "content-type": "text/csv" }, body: text });
  assert.equal(res.status, 201);
  return (await res.json()).data.upload.id;
};
const createEnrichment = (body) =>
  fetch(`${baseUrl}/enrichments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const expectError = async (res, status, code) => {
  assert.equal(res.status, status);
  const body = await res.json();
  assert.equal(body.error.code, code);
  return body;
};

before(async () => {
  await resetDatabase();
  dir = await mkdtemp(path.join(tmpdir(), "advectus-enrich-"));
  const uploads = createUploadService({ dir, maxBytes: 10 * 1024 * 1024 });
  ({ server, baseUrl, queue } = await startTestApp({ uploads }));
});

after(async () => {
  await stopTestApp(server);
  await closeDatabase();
  await rm(dir, { recursive: true, force: true });
});

test("POST /enrichments creates a queued job and enqueues split-csv", async () => {
  const uploadId = await uploadText(await readFile(SAMPLE, "utf8"));
  const res = await createEnrichment({ uploadId });
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.message, "Enrichment job created and queued.");
  const { job, links } = body.data;
  assert.equal(job.uploadId, uploadId);
  assert.equal(job.status, "queued");
  assert.equal(job.totalRows, null);
  assert.equal(res.headers.get("location"), links.self);

  assert.equal(queue.added.length, 1);
  assert.deepEqual(queue.added[0], { name: "split-csv", data: { jobId: job.id }, opts: { jobId: `split-csv-${job.id}` } });
});

test("POST /enrichments marks the job failed when the queue rejects it", async () => {
  const uploadId = await uploadText(CSV_MIN);
  const broken = { add: async () => { throw new Error("redis down"); } };
  const { server: s2, baseUrl: url2 } = await startTestApp({ queue: broken, uploads: undefined });
  try {
    const res = await fetch(`${url2}/enrichments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uploadId }) });
    await expectError(res, 500, "INTERNAL_ERROR");
    const failed = await Job.findOne({ where: { uploadId }, order: [["createdAt", "DESC"]] });
    assert.equal(failed.status, "failed");
    assert.match(failed.error, /redis down/);
  } finally {
    await stopTestApp(s2);
  }
});

test("split-csv job stores every data row and leaves the job ready", async () => {
  const uploadId = await uploadText(await readFile(SAMPLE, "utf8"));
  const { job } = (await (await createEnrichment({ uploadId })).json()).data;

  const result = await splitCsvJob.handle({ jobId: job.id }, ctx());
  assert.equal(result.totalRows, 30);

  const stored = await Job.findByPk(job.id);
  assert.equal(stored.status, "running", "rows stored and resolve chunks queued");
  assert.equal(stored.totalRows, 30);
  assert.deepEqual(stored.counters, {
    emptyRows: 2,
    withBusinessId: 23,
    withName: 27,
    invalidBusinessIds: 2,
    invalidRows: 0,
    queuedRows: 30,
  });
  assert.equal(stored.format.delimiter, ";");
  assert.deepEqual(stored.format.columns.businessId, { index: 0, header: "business_id" });
  assert.ok(stored.startedAt);

  const rows = await JobRow.findAll({ where: { jobId: job.id }, order: [["rowNumber", "ASC"]], raw: true });
  assert.equal(rows.length, 30);
  assert.deepEqual(rows[0].input, { businessId: { input: "0112038-9", normalized: "0112038-9", valid: true, reason: null }, name: "Nokia Oyj" });
  assert.equal(rows[0].line, 2);
  const fiPrefixed = rows.find((r) => r.input.businessId?.input === "FI01120389");
  assert.equal(fiPrefixed.input.businessId.normalized, "0112038-9");
  const badChecksum = rows.find((r) => r.input.businessId?.input === "0112038-8");
  assert.deepEqual(badChecksum.input.businessId, { input: "0112038-8", normalized: "0112038-8", valid: false, reason: "CHECKSUM" });
  assert.equal(badChecksum.status, "queued", "still resolvable: it has a name to fall back to");
});

test("split-csv marks rows with nothing to look up as invalid and is re-runnable", async () => {
  const uploadId = await uploadText("business_id;company_name\nABC-123;\n0112038-9;Nokia Oyj\n;\n");
  const { job } = (await (await createEnrichment({ uploadId })).json()).data;

  await splitCsvJob.handle({ jobId: job.id }, ctx());
  await splitCsvJob.handle({ jobId: job.id }, ctx()); // retry must not duplicate rows

  const rows = await JobRow.findAll({ where: { jobId: job.id }, order: [["rowNumber", "ASC"]], raw: true });
  assert.deepEqual(rows.map((r) => r.status), ["invalid", "queued"]);
  const stored = await Job.findByPk(job.id);
  assert.equal(stored.counters.invalidRows, 1);
  assert.equal(stored.counters.queuedRows, 1);
  assert.equal(stored.counters.emptyRows, 1);
});

test("GET /enrichments/:id and /rows return the stored state with pagination and status filter", async () => {
  const uploadId = await uploadText(await readFile(SAMPLE, "utf8"));
  const { job } = (await (await createEnrichment({ uploadId })).json()).data;
  await splitCsvJob.handle({ jobId: job.id }, ctx());

  const status = await (await fetch(`${baseUrl}/enrichments/${job.id}`)).json();
  assert.equal(status.data.job.status, "running");
  assert.equal(status.data.job.totalRows, 30);

  const page2 = await (await fetch(`${baseUrl}/enrichments/${job.id}/rows?page=2&limit=10`)).json();
  assert.equal(page2.data.rows.length, 10);
  assert.equal(page2.data.rows[0].rowNumber, 11);
  assert.deepEqual(page2.meta.pagination, { page: 2, limit: 10, total: 30, pages: 3 });
  assert.equal(page2.data.rows[0].jobId, undefined, "row DTO omits the job id");

  const queued = await (await fetch(`${baseUrl}/enrichments/${job.id}/rows?status=queued&limit=1000`)).json();
  assert.equal(queued.meta.pagination.total, 30);
  const invalid = await (await fetch(`${baseUrl}/enrichments/${job.id}/rows?status=invalid`)).json();
  assert.equal(invalid.meta.pagination.total, 0);
});

test("POST /enrichments rejects an unusable upload with 422 UPLOAD_NOT_USABLE", async () => {
  const uploadId = await uploadText("business_id;company_name\n");
  const body = await expectError(await createEnrichment({ uploadId }), 422, "UPLOAD_NOT_USABLE");
  assert.match(body.error.message, /no data rows/i);
  assert.equal(body.error.details[0].code, "NO_DATA_ROWS");
  assert.equal(queue.added.filter((j) => j.data.jobId === undefined).length, 0);
});

test("POST /enrichments when the upload's file has vanished → 410 UPLOAD_FILE_MISSING", async () => {
  const uploadId = await uploadText(CSV_MIN);
  await unlink((await Upload.findByPk(uploadId)).path);
  await expectError(await createEnrichment({ uploadId }), 410, "UPLOAD_FILE_MISSING");
  await expectError(await fetch(`${baseUrl}/uploads/${uploadId}/inspect`), 410, "UPLOAD_FILE_MISSING");
});

test("POST /enrichments with an unknown upload → 404, bad body → 400", async () => {
  await expectError(await createEnrichment({ uploadId: "00000000-0000-4000-8000-000000000000" }), 404, "UPLOAD_NOT_FOUND");
  const body = await expectError(await createEnrichment({ uploadId: "nope" }), 400, "VALIDATION_FAILED");
  assert.equal(body.error.details[0].field, "uploadId");
});

test("GET /enrichments/:id → 404 for unknown, 400 for bad id or bad row filters", async () => {
  await expectError(await fetch(`${baseUrl}/enrichments/00000000-0000-4000-8000-000000000000`), 404, "ENRICHMENT_NOT_FOUND");
  await expectError(await fetch(`${baseUrl}/enrichments/nope`), 400, "VALIDATION_FAILED");
  const body = await expectError(
    await fetch(`${baseUrl}/enrichments/00000000-0000-4000-8000-000000000000/rows?status=weird&limit=9999`),
    400,
    "VALIDATION_FAILED",
  );
  assert.deepEqual(body.error.details.map((d) => d.field).sort(), ["limit", "status"]);
});
