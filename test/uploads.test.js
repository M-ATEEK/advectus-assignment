import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUploadService } from "../services/uploads.js";
import { closeDatabase, resetDatabase, startTestApp, stopTestApp } from "./helpers/app.js";

const CSV = "business_id;company_name\n0112038-9;Nokia Oyj\n;Tikkurila Oyj\n";
let server, baseUrl, dir;

const post = (init) => fetch(`${baseUrl}/uploads`, { method: "POST", ...init });
const multipart = (content, name, type) => {
  const form = new FormData();
  form.append("file", new Blob([content], type ? { type } : undefined), name);
  return form;
};
const expectError = async (res, status, code) => {
  assert.equal(res.status, status);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, code);
  assert.ok(body.error.requestId, "error carries the request id");
  return body;
};

before(async () => {
  await resetDatabase();
  dir = await mkdtemp(path.join(tmpdir(), "advectus-uploads-"));
  const uploads = createUploadService({ dir, maxBytes: 1024, sniffBytes: 64 });
  ({ server, baseUrl } = await startTestApp({ uploads }));
});

after(async () => {
  await stopTestApp(server);
  await closeDatabase();
  await rm(dir, { recursive: true, force: true });
});

test("multipart upload is streamed to disk and described in the response envelope", async () => {
  const res = await post({ body: multipart(CSV, "companies.csv", "text/csv") });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.message, "CSV received and stored.");
  const { upload } = body.data;
  assert.equal(upload.fileName, "companies.csv");
  assert.equal(upload.bytes, Buffer.byteLength(CSV));
  assert.match(upload.sha256, /^[0-9a-f]{64}$/);
  assert.equal(upload.path, undefined, "server paths never leak");
  assert.equal(res.headers.get("location"), `/api/v1/uploads/${upload.id}`);
  assert.equal(await readFile(path.join(dir, `${upload.id}.csv`), "utf8"), CSV);
});

test("raw text/csv body is accepted and X-File-Name is honoured", async () => {
  const res = await post({ headers: { "content-type": "text/csv; charset=utf-8", "x-file-name": "raw.csv" }, body: CSV });
  assert.equal(res.status, 201);
  const { data } = await res.json();
  assert.equal(data.upload.fileName, "raw.csv");
  assert.equal(data.upload.contentType, "text/csv");
});

test("file above the size limit → 413 UPLOAD_TOO_LARGE and nothing stored", async () => {
  const before = (await readdir(dir)).length;
  const res = await post({ headers: { "content-type": "text/csv" }, body: "x".repeat(5000) });
  const body = await expectError(res, 413, "UPLOAD_TOO_LARGE");
  assert.match(body.error.message, /0 MB upload limit/);
  assert.equal((await readdir(dir)).length, before);
});

test("binary content → 400 UPLOAD_NOT_TEXT", async () => {
  const res = await post({ body: multipart(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), "archive.csv") });
  await expectError(res, 400, "UPLOAD_NOT_TEXT");
});

test("empty file → 400 UPLOAD_EMPTY", async () => {
  const res = await post({ headers: { "content-type": "text/csv" }, body: "" });
  await expectError(res, 400, "UPLOAD_EMPTY");
});

test("multipart without a file part → 400 UPLOAD_FILE_PART_MISSING", async () => {
  const form = new FormData();
  form.append("note", "no file here");
  const res = await post({ body: form });
  await expectError(res, 400, "UPLOAD_FILE_PART_MISSING");
});

test("multipart with the wrong field name → 400 UPLOAD_UNEXPECTED_FIELD", async () => {
  const form = new FormData();
  form.append("attachment", new Blob([CSV], { type: "text/csv" }), "a.csv");
  const res = await post({ body: form });
  const body = await expectError(res, 400, "UPLOAD_UNEXPECTED_FIELD");
  assert.match(body.error.message, /"attachment"/);
});

test("wrong multipart file type → 415 UPLOAD_UNSUPPORTED_FILE_TYPE", async () => {
  const res = await post({ body: multipart("<html>", "page.html", "text/html") });
  const body = await expectError(res, 415, "UPLOAD_UNSUPPORTED_FILE_TYPE");
  assert.match(body.error.message, /text\/html/);
});

test("unsupported request content type → 400 VALIDATION_FAILED from the validator", async () => {
  const res = await post({ headers: { "content-type": "application/json" }, body: JSON.stringify({ csv: CSV }) });
  const body = await expectError(res, 400, "VALIDATION_FAILED");
  assert.equal(body.error.details[0].field, "content-type");
  assert.equal(body.error.details[0].in, "headers");
});

test("X-File-Name with a path separator → 400 VALIDATION_FAILED", async () => {
  const res = await post({ headers: { "content-type": "text/csv", "x-file-name": "../etc/passwd" }, body: CSV });
  const body = await expectError(res, 400, "VALIDATION_FAILED");
  assert.equal(body.error.details[0].field, "x-file-name");
});

test("malformed JSON on a JSON route → 400 INVALID_JSON", async () => {
  const res = await fetch(`${baseUrl}/health`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad",
  });
  await expectError(res, 400, "INVALID_JSON");
});

// ---------------------------------------------------------------- inspect

const SAMPLE_PATH = new URL("../data/sample-companies.csv", import.meta.url);

const uploadText = async (text, headers = {}) => {
  const res = await post({ headers: { "content-type": "text/csv", ...headers }, body: text });
  assert.equal(res.status, 201);
  return (await res.json()).data.upload.id;
};
const inspect = (id, qs = "") => fetch(`${baseUrl}/uploads/${id}/inspect${qs}`);

test("inspect understands the sample CSV: delimiter, header, columns, counts, warnings", async () => {
  const id = await uploadText(await readFile(SAMPLE_PATH, "utf8"), { "x-file-name": "sample-companies.csv" });
  const res = await inspect(id);
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.upload.id, id);
  assert.equal(data.upload.fileName, "sample-companies.csv");

  const i = data.inspection;
  assert.equal(i.usable, true);
  assert.deepEqual(i.format, { delimiter: ";", hasBom: false, hasHeader: true, columnCount: 2 });
  assert.deepEqual(i.columns.businessId, { index: 0, header: "business_id" });
  assert.deepEqual(i.columns.name, { index: 1, header: "company_name" });
  assert.deepEqual(i.columns.headers, ["business_id", "company_name"]);

  assert.equal(i.rows.dataRows, 30);
  assert.equal(i.rows.emptyRows, 2, "the ';' row and the blank line");
  assert.equal(i.rows.withBusinessId, 23);
  assert.equal(i.rows.withName, 27);
  assert.equal(i.rows.withBoth, 20);
  assert.equal(i.rows.withNeither, 0);
  assert.equal(i.rows.validBusinessIds, 21);
  assert.equal(i.rows.invalidBusinessIds, 2, "0112038-8 (checksum) and ABC-123 (format)");
  assert.equal(i.rows.duplicateBusinessIds, 5, "Nokia ×4 (FI / hyphenless / short / mismatch rows) + KONE ×1");
  assert.equal(i.rows.truncated, false);

  assert.deepEqual(
    i.businessIds.invalidExamples.map((e) => [e.value, e.reason]),
    [["0112038-8", "CHECKSUM"], ["ABC-123", "FORMAT"]],
  );
  assert.equal(i.businessIds.duplicateTracking, "complete");
  assert.deepEqual(i.warnings.map((w) => w.code).sort(), ["DUPLICATE_BUSINESS_IDS", "INVALID_BUSINESS_IDS"]);
  assert.equal(i.samples.length, 5);
  assert.deepEqual(i.samples[0], { line: 2, businessId: { input: "0112038-9", normalized: "0112038-9", valid: true }, name: "Nokia Oyj" });
});

test("inspect honours maxRows and sampleSize and flags truncation", async () => {
  const id = await uploadText(await readFile(SAMPLE_PATH, "utf8"));
  const { data } = await (await inspect(id, "?maxRows=5&sampleSize=2")).json();
  assert.equal(data.inspection.rows.scanned, 5);
  assert.equal(data.inspection.rows.truncated, true);
  assert.equal(data.inspection.samples.length, 2);
  assert.ok(data.inspection.warnings.some((w) => w.code === "TRUNCATED"));
});

test("inspect infers columns from a headerless, comma-separated, BOM-prefixed file", async () => {
  const id = await uploadText("﻿Nokia Oyj,0112038-9\r\nKONE Oyj,1927400-1\r\nTikkurila Oyj,\r\n");
  const { data } = await (await inspect(id)).json();
  const i = data.inspection;
  assert.equal(i.usable, true);
  assert.deepEqual(i.format, { delimiter: ",", hasBom: true, hasHeader: false, columnCount: 2 });
  assert.equal(i.columns.businessId.index, 1);
  assert.equal(i.columns.name.index, 0);
  assert.equal(i.rows.dataRows, 3);
  assert.ok(i.warnings.some((w) => w.code === "NO_HEADER"));
});

test("inspect reports a header-only file as unusable instead of failing", async () => {
  const id = await uploadText("business_id;company_name\n");
  const res = await inspect(id);
  assert.equal(res.status, 200);
  const i = (await res.json()).data.inspection;
  assert.equal(i.usable, false);
  assert.equal(i.format.hasHeader, true);
  assert.equal(i.columns.businessId.index, 0);
  assert.equal(i.rows.dataRows, 0);
  assert.deepEqual(i.warnings.map((w) => w.code), ["NO_DATA_ROWS"]);
});

test("inspect of an unrecognised header falls back to inferring a name column and says so", async () => {
  const id = await uploadText("city;country\nEspoo;FI\nHelsinki;FI\n");
  const i = (await (await inspect(id)).json()).data.inspection;
  assert.equal(i.usable, true, "a text column is treated as names; the client sees NO_HEADER and NO_BUSINESS_ID_COLUMN");
  assert.equal(i.format.hasHeader, false);
  assert.equal(i.columns.businessId, null);
  assert.equal(i.columns.name.index, 0);
  assert.deepEqual(i.warnings.map((w) => w.code).sort(), ["NO_BUSINESS_ID_COLUMN", "NO_HEADER"]);
});

test("inspect of an unknown upload → 404 UPLOAD_NOT_FOUND", async () => {
  const res = await inspect("00000000-0000-4000-8000-000000000000");
  const body = await expectError(res, 404, "UPLOAD_NOT_FOUND");
  assert.match(body.error.message, /00000000-0000-4000-8000-000000000000/);
});

test("inspect with a malformed id or query → 400 VALIDATION_FAILED", async () => {
  await expectError(await inspect("not-a-uuid"), 400, "VALIDATION_FAILED");
  const id = await uploadText(CSV);
  const body = await expectError(await inspect(id, "?maxRows=0&sampleSize=99"), 400, "VALIDATION_FAILED");
  assert.deepEqual(body.error.details.map((d) => d.field).sort(), ["maxRows", "sampleSize"]);
});
