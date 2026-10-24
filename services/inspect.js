import { BUSINESS_ID_REASON } from "../domain/businessId.js";
import { readInputRows } from "./rowReader.js";
import { CSV_WARNINGS } from "../constants/messages.js";

const DUPLICATE_TRACK_LIMIT = 1_000_000;
const EXAMPLE_LIMIT = 10;

/**
 * Streams an uploaded CSV once and reports what the pipeline would understand from it:
 * delimiter, header, column mapping, row counts, business-ID validity, duplicates and samples.
 * Never throws for bad content; problems surface as `warnings` and `usable: false`.
 */
export const createInspectService = () => {
  const inspect = async (filePath, { maxRows = Infinity, sampleSize = 5 } = {}) => {
    const stats = {
      dataRows: 0,
      emptyRows: 0,
      withBusinessId: 0,
      withName: 0,
      withBoth: 0,
      withNeither: 0,
      validBusinessIds: 0,
      invalidBusinessIds: 0,
      duplicateBusinessIds: 0,
      raggedRows: 0,
    };
    const invalidExamples = [];
    const duplicateExamples = [];
    const samples = [];
    const seen = new Set();
    let duplicateTracking = "complete";
    let meta = null;

    for await (const item of readInputRows(filePath, { maxRows })) {
      if (item.type === "meta") {
        meta = item;
        continue;
      }
      if (item.empty) {
        stats.emptyRows++;
        continue;
      }
      stats.dataRows++;
      if (item.ragged) stats.raggedRows++;
      const { businessId, name, line } = item;

      if (businessId) stats.withBusinessId++;
      if (name) stats.withName++;
      if (businessId && name) stats.withBoth++;
      if (!businessId && !name) stats.withNeither++;

      if (businessId?.valid) {
        stats.validBusinessIds++;
        if (duplicateTracking === "complete") {
          if (seen.has(businessId.value)) {
            stats.duplicateBusinessIds++;
            if (duplicateExamples.length < EXAMPLE_LIMIT) duplicateExamples.push({ line, businessId: businessId.value });
          } else if (seen.size < DUPLICATE_TRACK_LIMIT) {
            seen.add(businessId.value);
          } else {
            duplicateTracking = "partial";
          }
        }
      } else if (businessId) {
        stats.invalidBusinessIds++;
        if (invalidExamples.length < EXAMPLE_LIMIT) invalidExamples.push({ line, value: businessId.input, reason: businessId.reason });
      }

      if (samples.length < sampleSize) {
        samples.push({
          line,
          businessId: businessId ? { input: businessId.input, normalized: businessId.value, valid: businessId.valid } : null,
          name,
        });
      }
    }

    const scanned = stats.dataRows + stats.emptyRows;
    const truncated = scanned >= maxRows;
    const columns = meta?.columns ?? { businessId: null, name: null, unmapped: [] };

    const warnings = [];
    if (meta && !meta.delimiterConfident) warnings.push(CSV_WARNINGS.DELIMITER_UNCERTAIN);
    if (!meta?.hasHeader) warnings.push(CSV_WARNINGS.NO_HEADER);
    if (!columns.businessId) warnings.push(CSV_WARNINGS.NO_BUSINESS_ID_COLUMN);
    if (!columns.name) warnings.push(CSV_WARNINGS.NO_NAME_COLUMN);
    if (stats.dataRows === 0) warnings.push(CSV_WARNINGS.NO_DATA_ROWS);
    if (stats.invalidBusinessIds > 0) warnings.push(CSV_WARNINGS.INVALID_BUSINESS_IDS);
    if (stats.duplicateBusinessIds > 0) warnings.push(CSV_WARNINGS.DUPLICATE_BUSINESS_IDS);
    if (stats.withNeither > 0) warnings.push(CSV_WARNINGS.ROWS_WITHOUT_KEYS);
    if (stats.raggedRows > 0) warnings.push(CSV_WARNINGS.RAGGED_ROWS);
    if (duplicateTracking === "partial") warnings.push(CSV_WARNINGS.DUPLICATE_CHECK_PARTIAL);
    if (truncated) warnings.push(CSV_WARNINGS.TRUNCATED);

    return {
      usable: Boolean((columns.businessId || columns.name) && stats.dataRows > 0),
      format: {
        delimiter: meta?.delimiter ?? ";",
        hasBom: meta?.hasBom ?? false,
        hasHeader: meta?.hasHeader ?? false,
        columnCount: meta?.width ?? 0,
      },
      columns: { businessId: columns.businessId, name: columns.name, unmapped: columns.unmapped, headers: meta?.headerRow ?? null },
      rows: { ...stats, scanned, truncated },
      businessIds: { invalidExamples, duplicateExamples, duplicateTracking, reasons: Object.values(BUSINESS_ID_REASON) },
      samples,
      warnings,
    };
  };

  return { inspect };
};
