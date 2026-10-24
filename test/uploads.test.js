import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../app.js";
import { createUploadService } from "../services/uploads.js";

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
  dir = await mkdtemp(path.join(tmpdir(), "advectus-uploads-"));
  const uploads = createUploadService({ dir, maxBytes: 1024, sniffBytes: 64 });
  server = createApp({ uploads }).listen(0);
  await new Promise((r) => server.once("listening", r));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(async () => {
  await new Promise((r) => server.close(r));
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
