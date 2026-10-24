import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { closeDatabase, startTestApp, stopTestApp } from "./helpers/app.js";

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestApp());
  baseUrl = baseUrl.replace(/\/api\/v1$/, "");
});

after(async () => {
  await stopTestApp(server);
  await closeDatabase();
});

test("GET /api/v1/health returns ok", async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.status, "ok");
  assert.equal(body.data.service, "advectus-assignment");
  assert.match(body.data.node, /^v\d+/);
});

test("unknown route returns a JSON 404", async () => {
  const res = await fetch(`${baseUrl}/api/v1/nope`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "ROUTE_NOT_FOUND");
  assert.match(body.error.message, /GET \/api\/v1\/nope/);
  assert.ok(body.error.requestId);
});
