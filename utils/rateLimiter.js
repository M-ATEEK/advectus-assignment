/**
 * Token bucket: at most `ratePerSec` calls per second, burst up to `ratePerSec`.
 * `wait()` resolves when a token is available. In-process only; one per worker.
 */
export const createRateLimiter = ({ ratePerSec, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) => {
  let tokens = ratePerSec;
  let last = now();

  const refill = () => {
    const current = now();
    tokens = Math.min(ratePerSec, tokens + ((current - last) / 1000) * ratePerSec);
    last = current;
  };

  return {
    async wait() {
      refill();
      while (tokens < 1) {
        await sleep(Math.ceil(((1 - tokens) / ratePerSec) * 1000));
        refill();
      }
      tokens -= 1;
    },
  };
};
