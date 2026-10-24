import config from "../config/index.js";
import { ERRORS } from "../constants/messages.js";
import { ApiError } from "../utils/ApiError.js";
import { createRateLimiter } from "../utils/rateLimiter.js";
import { createCircuitBreaker } from "../utils/circuitBreaker.js";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const unavailable = (reason, cause) => ApiError.from(ERRORS.YTJ_UNAVAILABLE, { params: { reason }, cause });

/**
 * Thin client for PRH's open YTJ v3 API, used only for companies the local register does not have.
 * Every call passes the circuit breaker, waits for a rate-limit token, times out, and retries on 429/5xx/network errors.
 * Returns raw PRH company records; normalisation happens in the caller.
 */
export const createYtjClient = ({
  baseUrl = config.ytj.baseUrl,
  timeoutMs = config.ytj.timeoutMs,
  retries = config.ytj.retries,
  ratePerSec = config.ytj.ratePerSec,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  limiter = createRateLimiter({ ratePerSec, sleep }),
  breaker = createCircuitBreaker(),
} = {}) => {
  const fetchOnce = async (url) => {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json", "user-agent": "advectus-assignment/0.1 (business-id enrichment)" },
    });
    if (res.ok) return res.json();
    const err = new Error(`HTTP ${res.status} from PRH`);
    err.status = res.status;
    throw err;
  };

  /** GET /companies?<params> → companies[] with retries; throws YTJ_UNAVAILABLE when it cannot get an answer. */
  const companies = async (params) => {
    if (!breaker.allows()) throw unavailable(`circuit breaker is ${breaker.state}`);

    const url = `${baseUrl}/companies?${new URLSearchParams(params)}`;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      await limiter.wait();
      try {
        const body = await fetchOnce(url);
        breaker.recordSuccess();
        return body.companies ?? [];
      } catch (err) {
        lastError = err;
        breaker.recordFailure({ force: err.status === 429 });
        const retryable = err.status === undefined || RETRYABLE_STATUS.has(err.status);
        if (!retryable || !breaker.allows() || attempt === retries) break;
        await sleep(500 * 2 ** attempt);
      }
    }
    throw unavailable(lastError.message, lastError);
  };

  return {
    /** @returns {Promise<object|null>} raw PRH record or null when PRH does not know the id */
    async findByBusinessId(businessId) {
      const [company] = await companies({ businessId });
      return company ?? null;
    },
    /** @returns {Promise<object[]>} first page of raw PRH records whose name contains `name` */
    searchByName(name) {
      return companies({ name });
    },
    get breakerState() {
      return breaker.state;
    },
  };
};
