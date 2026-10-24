import { HTTP_STATUS } from "./httpStatus.js";

/**
 * Single source of truth for every API message.
 * ERRORS entries are { code, status, message }; `code` is stable for clients, `message` is for humans.
 * Messages may contain {placeholders} filled by ApiError.from(entry, { params }).
 */
export const ERRORS = Object.freeze({
  // --- generic ---
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: "Something went wrong on our side. Please try again later.",
  },
  ROUTE_NOT_FOUND: {
    code: "ROUTE_NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "Route {method} {path} does not exist.",
  },
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Request validation failed.",
  },
  INVALID_JSON: {
    code: "INVALID_JSON",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Request body is not valid JSON.",
  },
  REQUEST_BODY_TOO_LARGE: {
    code: "REQUEST_BODY_TOO_LARGE",
    status: HTTP_STATUS.PAYLOAD_TOO_LARGE,
    message: "Request body exceeds the allowed size.",
  },
  REQUEST_ABORTED: {
    code: "REQUEST_ABORTED",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "The request was aborted before the body was fully received.",
  },

  // --- uploads ---
  UPLOAD_UNSUPPORTED_FILE_TYPE: {
    code: "UPLOAD_UNSUPPORTED_FILE_TYPE",
    status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
    message: 'Unsupported file type "{type}". Only CSV files are accepted.',
  },
  UPLOAD_FILE_PART_MISSING: {
    code: "UPLOAD_FILE_PART_MISSING",
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'Multipart request must contain exactly one file part named "file".',
  },
  UPLOAD_UNEXPECTED_FIELD: {
    code: "UPLOAD_UNEXPECTED_FIELD",
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'Unexpected file field "{field}". Use "file".',
  },
  UPLOAD_TOO_MANY_FILES: {
    code: "UPLOAD_TOO_MANY_FILES",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Only one file per request is accepted.",
  },
  UPLOAD_MALFORMED_MULTIPART: {
    code: "UPLOAD_MALFORMED_MULTIPART",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Malformed multipart request: {reason}",
  },
  UPLOAD_TOO_LARGE: {
    code: "UPLOAD_TOO_LARGE",
    status: HTTP_STATUS.PAYLOAD_TOO_LARGE,
    message: "File exceeds the {limitMb} MB upload limit.",
  },
  UPLOAD_NOT_TEXT: {
    code: "UPLOAD_NOT_TEXT",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "File does not look like a text CSV (binary content detected).",
  },
  UPLOAD_EMPTY: {
    code: "UPLOAD_EMPTY",
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Uploaded file is empty.",
  },
  UPLOAD_NOT_FOUND: {
    code: "UPLOAD_NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "No upload exists with id {id}.",
  },
  UPLOAD_FILE_MISSING: {
    code: "UPLOAD_FILE_MISSING",
    status: HTTP_STATUS.GONE,
    message: "The file for upload {id} is no longer available on the server. Upload it again.",
  },
  UPLOAD_NOT_USABLE: {
    code: "UPLOAD_NOT_USABLE",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: "The uploaded CSV cannot be enriched: {reasons}",
  },

  // --- enrichments ---
  ENRICHMENT_NOT_FOUND: {
    code: "ENRICHMENT_NOT_FOUND",
    status: HTTP_STATUS.NOT_FOUND,
    message: "No enrichment job exists with id {id}.",
  },
});

/** Non-fatal findings reported by CSV inspection. Codes are stable; text is for humans. */
export const CSV_WARNINGS = Object.freeze({
  DELIMITER_UNCERTAIN: { code: "DELIMITER_UNCERTAIN", message: "No delimiter found in the first line; assumed semicolon." },
  NO_HEADER: { code: "NO_HEADER", message: "No header row recognised; columns were inferred from the data." },
  NO_BUSINESS_ID_COLUMN: { code: "NO_BUSINESS_ID_COLUMN", message: "No business ID column found; rows will be matched by name only." },
  NO_NAME_COLUMN: { code: "NO_NAME_COLUMN", message: "No company name column found; rows will be matched by business ID only." },
  NO_DATA_ROWS: { code: "NO_DATA_ROWS", message: "The file contains no data rows." },
  INVALID_BUSINESS_IDS: { code: "INVALID_BUSINESS_IDS", message: "Some business IDs are malformed or fail the checksum." },
  DUPLICATE_BUSINESS_IDS: { code: "DUPLICATE_BUSINESS_IDS", message: "Some business IDs appear more than once." },
  ROWS_WITHOUT_KEYS: { code: "ROWS_WITHOUT_KEYS", message: "Some rows have neither a business ID nor a name and cannot be enriched." },
  RAGGED_ROWS: { code: "RAGGED_ROWS", message: "Some rows have a different number of columns than the header." },
  DUPLICATE_CHECK_PARTIAL: { code: "DUPLICATE_CHECK_PARTIAL", message: "Duplicate detection stopped after one million unique IDs." },
  TRUNCATED: { code: "TRUNCATED", message: "Scan stopped at the requested maxRows; counts cover the scanned part only." },
});

export const MESSAGES = Object.freeze({
  HEALTH_OK: "Service is healthy.",
  UPLOAD_RECEIVED: "CSV received and stored.",
  UPLOAD_INSPECTED: "CSV inspected.",
  ENRICHMENT_QUEUED: "Enrichment job created and queued.",
  ENRICHMENT_FETCHED: "Enrichment job fetched.",
  ENRICHMENT_ROWS_FETCHED: "Enrichment rows fetched.",
});
