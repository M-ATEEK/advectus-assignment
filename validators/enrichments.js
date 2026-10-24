import { body, param, query } from "express-validator";
import { ROW_STATUS } from "../constants/jobs.js";

export const createEnrichmentValidator = () => [
  body("uploadId").isUUID(4).withMessage("uploadId must be the UUID returned by POST /uploads."),
];

export const enrichmentIdValidator = () => [param("id").isUUID(4).withMessage("Enrichment id must be a UUID.")];

export const listRowsValidator = () => [
  ...enrichmentIdValidator(),
  query("status")
    .optional()
    .isIn(Object.values(ROW_STATUS))
    .withMessage(`status must be one of: ${Object.values(ROW_STATUS).join(", ")}.`),
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer.").toInt(),
  query("limit").optional().isInt({ min: 1, max: 1000 }).withMessage("limit must be between 1 and 1000.").toInt(),
];
