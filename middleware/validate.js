import { matchedData, validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";
import { ERRORS } from "../constants/messages.js";

/**
 * Runs the validator chains attached to a route and turns failures into one VALIDATION_FAILED error
 * whose details list every offending field. Usage: router.post(path, chains, validate, controller).
 *
 * On success the validated and sanitized values are exposed as `req.validated` (params, query, body).
 * Controllers read from there, never from req.query directly: Express 5 rebuilds req.query on each
 * access, so sanitizers such as toInt() would otherwise be lost.
 */
export const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) {
    req.validated = matchedData(req, { locations: ["params", "query", "body"], includeOptionals: false });
    return next();
  }

  const details = result.array({ onlyFirstError: true }).map(({ location, path, msg, value }) => ({
    in: location,
    field: path,
    message: msg,
    ...(value !== undefined && typeof value !== "object" ? { value } : {}),
  }));
  next(ApiError.from(ERRORS.VALIDATION_FAILED, { details }));
};
