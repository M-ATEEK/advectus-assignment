import { ApiError } from "../utils/ApiError.js";
import { ERRORS } from "../constants/messages.js";
import { sendError } from "../utils/apiResponse.js";

/** Maps errors raised by Express / body parsers / Node streams onto catalogue entries. */
const translate = (err) => {
  if (ApiError.is(err)) return err;
  if (err?.type === "entity.parse.failed") return ApiError.from(ERRORS.INVALID_JSON, { cause: err });
  if (err?.type === "entity.too.large") return ApiError.from(ERRORS.REQUEST_BODY_TOO_LARGE, { cause: err });
  if (err?.code === "ERR_STREAM_PREMATURE_CLOSE" || err?.code === "ECONNRESET") {
    return ApiError.from(ERRORS.REQUEST_ABORTED, { cause: err });
  }
  return ApiError.internal(err);
};

// Express 5 forwards rejected promises from async handlers here automatically.
export const errorHandler = (err, req, res, _next) => {
  const apiError = translate(err);

  if (apiError.status >= 500) req.log?.error({ err: apiError.cause ?? apiError }, "unhandled error");
  else req.log?.debug({ code: apiError.code }, "request rejected");

  if (res.headersSent) return res.end();
  sendError(res, apiError, req.id);
};
