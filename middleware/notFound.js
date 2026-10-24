import createError from "http-errors";

export const notFound = (req, _res, next) => {
  next(createError(404, `Route ${req.method} ${req.originalUrl} not found`));
};
