import { ApiError } from "../utils/ApiError.js";
import { ERRORS } from "../constants/messages.js";

export const notFound = (req, _res, next) => {
  next(ApiError.from(ERRORS.ROUTE_NOT_FOUND, { params: { method: req.method, path: req.originalUrl } }));
};
