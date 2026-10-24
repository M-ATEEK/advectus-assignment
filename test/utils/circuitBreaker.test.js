import { test } from "node:test";
import assert from "node:assert/strict";
import { createCircuitBreaker } from "../../utils/circuitBreaker.js";

test("opens after N consecutive failures, half-opens after the cooldown, closes on success", () => {
  let clock = 0;
  const breaker = createCircuitBreaker({ failures: 3, cooldownMs: 1000, now: () => clock });
  breaker.recordFailure();
  breaker.recordFailure();
  assert.equal(breaker.state, "closed");
  breaker.recordFailure();
  assert.equal(breaker.state, "open");
  assert.equal(breaker.allows(), false);
  clock = 1000;
  assert.equal(breaker.state, "half-open");
  assert.equal(breaker.allows(), true);
  breaker.recordSuccess();
  assert.equal(breaker.state, "closed");
});

test("a forced failure (429) opens at once; reopening doubles the cooldown up to the cap", () => {
  let clock = 0;
  const breaker = createCircuitBreaker({ failures: 5, cooldownMs: 1000, maxCooldownMs: 3000, now: () => clock });
  breaker.recordFailure({ force: true });
  assert.equal(breaker.state, "open");
  clock = 1000; // half-open, probe fails again
  breaker.recordFailure({ force: true });
  assert.equal(breaker.allows(), false);
  clock = 2500;
  assert.equal(breaker.allows(), false, "cooldown is now 2000");
  clock = 3000;
  assert.equal(breaker.allows(), true);
  breaker.recordFailure({ force: true });
  clock = 3000 + 3000;
  assert.equal(breaker.allows(), true, "capped at 3000");
});
