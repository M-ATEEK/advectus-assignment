import { HTTP_STATUS } from "../constants/httpStatus.js";

/**
 * Every response leaves through one of these, so the envelope is identical everywhere:
 *   success → { success: true,  message, data, meta? }
 *   error   → { success: false, error: { code, message, details?, requestId } }
 */
export const sendSuccess = (res, { status = HTTP_STATUS.OK, message, data = null, meta, headers } = {}) => {
  if (headers) res.set(headers);
  return res.status(status).json({ success: true, message, data, ...(meta ? { meta } : {}) });
};

export const sendCreated = (res, { message, data, location, meta }) =>
  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    message,
    data,
    meta,
    headers: location ? { Location: location } : undefined,
  });

export const sendAccepted = (res, options) => sendSuccess(res, { ...options, status: HTTP_STATUS.ACCEPTED });

export const sendError = (res, apiError, requestId) =>
  res.status(apiError.status).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  });
