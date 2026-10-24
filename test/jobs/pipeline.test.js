import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUploadService } from "../../services/uploads.js";
import { createCompanyLookup } from "../../services/companyLookup.js";
import { saveApiCompanies, toCompanyRow, upsertCompanies } from "../../services/companies.js";
import { splitCsvJob } from "../../jobs/splitCsvJob.js";
import { resolveRowsJob } from "../../jobs/resolveRowsJob.js";
import { finalizeJob } from "../../jobs/finalizeJob.js";
import { Job, JobRow } from "../../models/index.js";
import { closeDatabase, createFakeQueue, resetDatabase, startTestApp, stopTestApp } from "../helpers/app.js";
import { ytjFixture } from "../helpers/fixtures.js";

const silentLog = { info() {}, warn() {}, error() {}, debug() {} };
const unavailable = Object.assign(new Error("PRH open data API is unavailable: timeout"), { code: "YTJ_UNAVAILABLE" });
let server, baseUrl, dir;

/** Runs split → every resolve chunk → finalize, the way the worker would, with the given PRH double. */
const runPipeline = async (jobId, ytj) => {
  const queue = createFakeQueue();
  const lookup = createCompanyLookup({ ytj });
  await splitCsvJob.handle({ jobId }, { log: silentLog, queue });
  for (const chunk of queue.added.filter((j) => j.name === "resolve-rows")) {
    await resolveRowsJob.handle(chunk.data, { log: silentLog, queue, lookup });
  }
  const finalize = queue.added.find((j) => j.name === "finalize-job");
  assert.ok(finalize, "last chunk enqueued finalize");
  await finalizeJob.handle(finalize.data, { log: silentLog, queue });
  return { queue, lookup };
};
const createJob = async (csv) => {
  const up = await fetch(`${baseUrl}/uploads`, { method: "POST", headers: { "content-type": "text/csv" }, body: csv });
  const { id: uploadId } = (await up.json()).data.upload;
  const res = await fetch(`${baseUrl}/enrichments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uploadId }) });
  return (await res.json()).data.job.id;
};
const rowsOf = (jobId) => JobRow.findAll({ where: { jobId }, order: [["rowNumber", "ASC"]], raw: true });

before(async () => {
  await resetDatabase();
  dir = await mkdtemp(path.join(tmpdir(), "advectus-pipeline-"));
  ({ server, baseUrl } = await startTestApp({ uploads: createUploadService({ dir, maxBytes: 10 * 1024 * 1024 }) }));
  // a small local register: the eight fixture companies
  const fixtures = ["nokia-api", "housing-company", "limited-partnership", "bankrupt", "dissolved", "po-box-no-current-name", "sole-trader-like-ay-with-aux-names", "liquidation"];
  await upsertCompanies(fixtures.map((f) => toCompanyRow(ytjFixture(f), { source: "dump", datasetVersionId: 1, fetchedAt: new Date("2026-10-23") })));
});
after(async () => {
  await stopTestApp(server);
  await closeDatabase();
  await rm(dir, { recursive: true, force: true });
});

test("full pipeline on the sample CSV with PRH knowing nothing extra", async () => {
  const jobId = await createJob(await readFile(new URL("../../data/sample-companies.csv", import.meta.url), "utf8"));
  await runPipeline(jobId, { findByBusinessId: async () => null, searchByName: async () => [] });

  const job = await Job.findByPk(jobId);
  assert.equal(job.status, "done");
  const rows = await rowsOf(jobId);
  const by = (input) => rows.find((r) => r.input.businessId?.input === input || (!input.includes("-") && r.input.name === input.trim()));

  assert.equal(by("0112038-9").status, "matched");
  assert.equal(by("0112038-9").result.confidence, "business-id");
  assert.equal(by("0112038-9").result.customer.vatRegistrationNumber, "FI01120389");
  assert.equal(by("FI01120389").status, "matched", "FI-prefixed id normalised before lookup");
  assert.deepEqual(by("0112038-8").result.warnings, ["INVALID_BUSINESS_ID"], "bad checksum, matched by name");
  assert.equal(by("0112038-8").result.confidence, "name-exact");
  assert.equal(by("  tikkurila oyj").status, "not_found", "Tikkurila is not in this small register");
  assert.equal(by("Yritys Jota Ei Ole Olemassa Oy").status, "not_found");
  assert.equal(by("1234567-1").status, "not_found", "valid id unknown to PRH, name unknown too");
  assert.equal(by("1927400-1").status, "not_found", "KONE is not in this small register and PRH double knows nothing");
  assert.equal(rows.filter((r) => r.status === "pending").length, 0);
  assert.equal(job.counters.rows.matched + job.counters.rows.not_found, 30);
});

test("GET /enrichments/:id/results returns normalized company + customer per row, filterable by status", async () => {
  const jobId = await createJob("business_id;company_name\n0112038-9;Nokia Oyj\n;Olematon Oy\n");
  await runPipeline(jobId, { findByBusinessId: async () => null, searchByName: async () => [] });

  const res = await fetch(`${baseUrl}/enrichments/${jobId}/results`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.job.status, "done");
  assert.equal(body.meta.pagination.total, 2);
  const [nokia, missing] = body.data.results;
  assert.equal(nokia.status, "matched");
  assert.equal(nokia.confidence, "business-id");
  assert.equal(nokia.company.name, "Nokia Oyj");
  assert.equal(nokia.company.mainBusinessLine.en, "Activities of head offices");
  assert.equal(nokia.customer.externalId, "0112038-9");
  assert.equal(nokia.customer.vatRegistrationNumber, "FI01120389");
  assert.equal(nokia.customer.addressbook.length, 2);
  assert.equal(missing.status, "not_found");
  assert.equal(missing.company, null);
  assert.equal(missing.customer, null);

  const onlyMatched = await (await fetch(`${baseUrl}/enrichments/${jobId}/results?status=matched`)).json();
  assert.equal(onlyMatched.meta.pagination.total, 1);
  await expectBadLimit(jobId);
});

const expectBadLimit = async (jobId) => {
  const res = await fetch(`${baseUrl}/enrichments/${jobId}/results?limit=99999`);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "VALIDATION_FAILED");
};

test("PRH outage leaves rows pending, job partial, retry scheduled; retry resolves them and finalize closes the job", async () => {
  const jobId = await createJob("business_id;company_name\n0112038-9;Nokia Oyj\n1927400-1;KONE Oyj\n");
  const { queue } = await runPipeline(jobId, {
    findByBusinessId: async () => { throw unavailable; },
    searchByName: async () => { throw unavailable; },
  });

  let job = await Job.findByPk(jobId);
  assert.equal(job.status, "partial");
  const rows = await rowsOf(jobId);
  assert.equal(rows[0].status, "matched", "Nokia is local, no PRH needed");
  assert.equal(rows[1].status, "pending");
  assert.deepEqual(rows[1].result.warnings, ["PRH_UNAVAILABLE"]);
  const retry = queue.added.find((j) => j.name === "resolve-rows" && j.data.retryPending);
  assert.ok(retry && retry.opts.delay > 0, "delayed retry queued");
  assert.ok(queue.added.find((j) => j.name === "finalize-job" && j.data.attempt === 1));

  // PRH is back: the retry resolves the pending row through the API, written through to the local register
  const kone = { ...ytjFixture("housing-company"), businessId: { value: "1927400-1" }, names: [{ name: "KONE Oyj", type: "1" }] };
  const lookup = createCompanyLookup({ ytj: { findByBusinessId: async () => kone, searchByName: async () => [] } });
  await resolveRowsJob.handle(retry.data, { log: silentLog, queue, lookup });
  await finalizeJob.handle({ jobId, attempt: 1 }, { log: silentLog, queue });

  job = await Job.findByPk(jobId);
  assert.equal(job.status, "done");
  const after = await rowsOf(jobId);
  assert.equal(after[1].status, "matched");
  assert.equal(after[1].result.customer.custentity_ytj_source, "api");
});

test("finalize does nothing while rows are still queued", async () => {
  const jobId = await createJob("business_id;company_name\n0112038-9;Nokia Oyj\n");
  const queue = createFakeQueue();
  await splitCsvJob.handle({ jobId }, { log: silentLog, queue });
  const out = await finalizeJob.handle({ jobId }, { log: silentLog, queue });
  assert.equal(out.counts.queued, 1);
  assert.equal((await Job.findByPk(jobId)).status, "running");
  assert.equal(typeof saveApiCompanies, "function");
});
