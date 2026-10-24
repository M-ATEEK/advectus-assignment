import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../../utils/rateLimiter.js";

test("allows a burst of ratePerSec, then waits for refill", async () => {
  let clock = 0;
  const sleeps = [];
  const limiter = createRateLimiter({ ratePerSec: 2, now: () => clock, sleep: async (ms) => { sleeps.push(ms); clock += ms; } });
  await limiter.wait();
  await limiter.wait();
  assert.deepEqual(sleeps, [], "two calls fit in the initial burst");
  await limiter.wait();
  assert.deepEqual(sleeps, [500], "third call waited for one token at 2/s");
});
