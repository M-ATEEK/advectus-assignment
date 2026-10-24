/**
 * Circuit breaker with three states:
 *   closed    → calls go through; `failures` consecutive failures open it
 *   open      → calls are refused until the cooldown passes (cooldown doubles each time it reopens, up to a cap)
 *   half-open → one call is allowed through; success closes, failure reopens
 * In-process only; one per worker.
 */
export const createCircuitBreaker = ({ failures = 5, cooldownMs = 30_000, maxCooldownMs = 600_000, now = Date.now } = {}) => {
  let consecutiveFailures = 0;
  let openedAt = null;
  let cooldown = cooldownMs;

  const open = () => {
    openedAt = now();
  };

  return {
    /** True when a call may proceed (closed, or open but cooled down = half-open). */
    allows() {
      if (openedAt === null) return true;
      return now() - openedAt >= cooldown;
    },
    recordSuccess() {
      consecutiveFailures = 0;
      openedAt = null;
      cooldown = cooldownMs;
    },
    /** `force` opens immediately (used for HTTP 429: the provider told us to stop). */
    recordFailure({ force = false } = {}) {
      consecutiveFailures += 1;
      const wasOpen = openedAt !== null;
      if (force || consecutiveFailures >= failures) {
        if (wasOpen) cooldown = Math.min(cooldown * 2, maxCooldownMs);
        open();
      }
    },
    get state() {
      if (openedAt === null) return "closed";
      return this.allows() ? "half-open" : "open";
    },
  };
};
