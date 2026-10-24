import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";
import { ERRORS } from "../constants/messages.js";

/**
 * Runs the validator chains attached to a route and turns failures into one VALIDATION_FAILED error
 * whose details list every offending field. Usage: router.post(path, chains, validate, controller).
 */
export const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array({ onlyFirstError: true }).map(({ location, path, msg, value }) => ({
    in: location,
    field: path,
    message: msg,
    ...(value !== undefined && typeof value !== "object" ? { value } : {}),
  }));
  next(ApiError.from(ERRORS.VALIDATION_FAILED, { details }));
};
