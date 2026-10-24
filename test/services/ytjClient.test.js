import { test } from "node:test";
import assert from "node:assert/strict";
import { createYtjClient } from "../../services/ytjClient.js";
import { createCircuitBreaker } from "../../utils/circuitBreaker.js";
import { ytjFixture } from "../helpers/fixtures.js";

const nokia = ytjFixture("nokia-api");
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const noWait = { wait: async () => {} };

/** fetch double that replays a scripted list of responses (or throws when given an Error) and records calls. */
const scripted = (...responses) => {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  fn.calls = calls;
  return fn;
};
const client = (fetchImpl, extra = {}) =>
  createYtjClient({ baseUrl: "https://prh.test/v3", fetchImpl, limiter: noWait, sleep: async () => {}, retries: 2, ...extra });

test("findByBusinessId returns the raw record, null when PRH has no match", async () => {
  const fetchImpl = scripted(json({ totalResults: 1, companies: [nokia] }), json({ totalResults: 0, companies: [] }));
  const ytj = client(fetchImpl);
  assert.equal((await ytj.findByBusinessId("0112038-9")).businessId.value, "0112038-9");
  assert.equal(await ytj.findByBusinessId("1234567-1"), null);
  assert.equal(fetchImpl.calls[0], "https://prh.test/v3/companies?businessId=0112038-9");
});

test("searchByName encodes the query and returns the companies array", async () => {
  const fetchImpl = scripted(json({ totalResults: 1, companies: [nokia] }));
  const hits = await client(fetchImpl).searchByName("Nokia Oyj");
  assert.equal(hits.length, 1);
  assert.equal(fetchImpl.calls[0], "https://prh.test/v3/companies?name=Nokia+Oyj");
});

test("retries on 5xx and network errors, then succeeds", async () => {
  const fetchImpl = scripted(json({}, 503), new TypeError("fetch failed"), json({ companies: [nokia] }));
  const company = await client(fetchImpl).findByBusinessId("0112038-9");
  assert.equal(company.businessId.value, "0112038-9");
  assert.equal(fetchImpl.calls.length, 3);
});

test("gives up after the retries with YTJ_UNAVAILABLE", async () => {
  const fetchImpl = scripted(json({}, 500), json({}, 500), json({}, 500));
  await assert.rejects(() => client(fetchImpl).findByBusinessId("0112038-9"), (err) => err.code === "YTJ_UNAVAILABLE" && /HTTP 500/.test(err.message));
  assert.equal(fetchImpl.calls.length, 3);
});

test("a 4xx other than 429 is not retried", async () => {
  const fetchImpl = scripted(json({}, 400));
  await assert.rejects(() => client(fetchImpl).findByBusinessId("x"), (err) => err.code === "YTJ_UNAVAILABLE");
  assert.equal(fetchImpl.calls.length, 1);
});

test("429 opens the breaker: no retry, and the next call fails fast without touching PRH", async () => {
  let clock = 0;
  const breaker = createCircuitBreaker({ cooldownMs: 30_000, now: () => clock });
  const fetchImpl = scripted(json({}, 429), json({ companies: [nokia] }));
  const ytj = client(fetchImpl, { breaker });

  await assert.rejects(() => ytj.findByBusinessId("0112038-9"), (err) => err.code === "YTJ_UNAVAILABLE");
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(ytj.breakerState, "open");

  await assert.rejects(() => ytj.findByBusinessId("0112038-9"), (err) => /circuit breaker is open/.test(err.message));
  assert.equal(fetchImpl.calls.length, 1, "no network call while open");

  clock = 30_000; // half-open: one probe allowed, it succeeds and closes the breaker
  assert.equal((await ytj.findByBusinessId("0112038-9")).businessId.value, "0112038-9");
  assert.equal(ytj.breakerState, "closed");
});

test("timeouts surface as YTJ_UNAVAILABLE", async () => {
  const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
  const fetchImpl = scripted(timeout, timeout, timeout);
  await assert.rejects(() => client(fetchImpl).findByBusinessId("0112038-9"), (err) => err.code === "YTJ_UNAVAILABLE" && /timeout/i.test(err.message));
});
