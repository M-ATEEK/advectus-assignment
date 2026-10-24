import { ERRORS } from "../constants/messages.js";

const fill = (template, params = {}) =>
  template.replace(/\{(\w+)\}/g, (_, key) => (params[key] === undefined ? `{${key}}` : String(params[key])));

/**
 * The only error type that reaches clients with a defined shape.
 * Always built from an ERRORS catalogue entry, so status, code and message stay consistent.
 */
export class ApiError extends Error {
  /**
   * @param {{code: string, status: number, message: string}} entry   an ERRORS entry
   * @param {{params?: Record<string, unknown>, details?: unknown, cause?: unknown}} [options]
   */
  constructor(entry, { params, details, cause } = {}) {
    super(fill(entry.message, params), cause ? { cause } : undefined);
    this.name = "ApiError";
    this.status = entry.status;
    this.code = entry.code;
    this.details = details;
    this.expose = entry.status < 500;
  }

  static from(entry, options) {
    return new ApiError(entry, options);
  }

  static internal(cause) {
    return new ApiError(ERRORS.INTERNAL_ERROR, { cause });
  }

  static is(err) {
    return err instanceof ApiError;
  }
}
