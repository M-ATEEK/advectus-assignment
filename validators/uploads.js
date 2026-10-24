import { header } from "express-validator";

export const MULTIPART = "multipart/form-data";

/** Content types a CSV may legitimately arrive under (browsers and Excel disagree). */
export const CSV_CONTENT_TYPES = Object.freeze([
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

/** `text/csv; charset=utf-8` → `text/csv` */
export const baseContentType = (value = "") => value.split(";")[0].trim().toLowerCase();

export const createUploadValidator = () => [
  header("content-type")
    .exists({ checkFalsy: true })
    .withMessage("Content-Type header is required.")
    .bail()
    // Validate the media type only; never sanitize this header in place, busboy needs the boundary parameter.
    .custom((value) => [MULTIPART, ...CSV_CONTENT_TYPES].includes(baseContentType(value)))
    .withMessage(`Content-Type must be ${MULTIPART} or one of: ${CSV_CONTENT_TYPES.join(", ")}.`),
  header("x-file-name")
    .optional()
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage("X-File-Name must be 1–255 characters.")
    .not()
    .matches(/[\\/]/)
    .withMessage("X-File-Name must not contain path separators."),
  // An empty body is reported by the service as UPLOAD_EMPTY, so zero is allowed here.
  header("content-length")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Content-Length must be a non-negative integer."),
];
