import createError from "http-errors";

// Express 5 forwards rejected promises from async handlers here automatically.
export const errorHandler = (err, req, res, _next) => {
  const error = createError.isHttpError(err) ? err : createError(500, err);
  const status = error.status ?? 500;

  if (status >= 500) req.log?.error({ err }, "unhandled error");

  res.status(status).json({
    success: false,
    error: {
      status,
      message: status >= 500 && req.app.get("env") === "production" ? "Internal Server Error" : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
};
