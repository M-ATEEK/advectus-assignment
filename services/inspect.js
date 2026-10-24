import { parseBusinessId, BUSINESS_ID_REASON } from "../domain/businessId.js";
import { detectHeader, mapColumns } from "../domain/columnMapping.js";
import { detectDelimiter, readRows, readSample } from "./csv.js";
import { CSV_WARNINGS } from "../constants/messages.js";

const HEADERLESS_SAMPLE = 20;
const DUPLICATE_TRACK_LIMIT = 1_000_000;
const EXAMPLE_LIMIT = 10;

const isEmptyRow = (cells) => cells.every((c) => c === "" || c === null || c === undefined);
const cell = (cells, col) => (col ? (cells[col.index] ?? "").trim() : "");

/**
 * Streams an uploaded CSV once and reports what the pipeline would understand from it:
 * delimiter, header, column mapping, row counts, business-ID validity, duplicates and samples.
 * Never throws for bad content; problems surface as `warnings` and `usable: false`.
 */
export const createInspectService = () => {
  const inspect = async (filePath, { maxRows = Infinity, sampleSize = 5 } = {}) => {
    const { text, hasBom } = await readSample(filePath);
    const { delimiter, confident } = detectDelimiter(text);

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
    let headerRow = null;
    let columns = null;
    let truncated = false;
    let width = null;
    const pending = []; // rows buffered until the header decision is made (headerless detection)

    const finishColumnDetection = (firstRows) => {
      const hasHeader = detectHeader(firstRows[0]);
      headerRow = hasHeader ? firstRows[0] : null;
      columns = mapColumns({ headerRow, sampleRows: hasHeader ? firstRows.slice(1) : firstRows });
      width = headerRow ? headerRow.length : Math.max(...firstRows.map((r) => r.length));
      return hasHeader ? firstRows.slice(1) : firstRows;
    };

    const scanned = () => stats.dataRows + stats.emptyRows;

    const consume = (cells, line) => {
      if (scanned() >= maxRows) {
        truncated = true;
        return false;
      }
      if (isEmptyRow(cells)) {
        stats.emptyRows++;
        return true;
      }
      if (cells.length !== width) stats.raggedRows++;
      stats.dataRows++;
      const rawId = cell(cells, columns.businessId);
      const name = cell(cells, columns.name);

      if (rawId) stats.withBusinessId++;
      if (name) stats.withName++;
      if (rawId && name) stats.withBoth++;
      if (!rawId && !name) stats.withNeither++;

      let parsed = null;
      if (rawId) {
        parsed = parseBusinessId(rawId);
        if (parsed.valid) {
          stats.validBusinessIds++;
          if (duplicateTracking === "complete") {
            if (seen.has(parsed.value)) {
              stats.duplicateBusinessIds++;
              if (duplicateExamples.length < EXAMPLE_LIMIT) duplicateExamples.push({ line, businessId: parsed.value });
            } else if (seen.size < DUPLICATE_TRACK_LIMIT) {
              seen.add(parsed.value);
            } else {
              duplicateTracking = "partial";
            }
          }
        } else {
          stats.invalidBusinessIds++;
          if (invalidExamples.length < EXAMPLE_LIMIT) invalidExamples.push({ line, value: rawId, reason: parsed.reason });
        }
      }

      if (samples.length < sampleSize) {
        samples.push({
          line,
          businessId: parsed ? { input: rawId, normalized: parsed.value, valid: parsed.valid } : null,
          name: name || null,
        });
      }
      return true;
    };

    const flushPending = () => {
      const rows = finishColumnDetection(pending.map((p) => p.cells));
      const offset = pending.length - rows.length;
      rows.every((cells, i) => consume(cells, pending[i + offset].line));
      pending.length = 0;
    };

    for await (const { record, info } of readRows(filePath, { delimiter })) {
      const line = info.lines;
      if (!columns) {
        pending.push({ cells: record, line });
        // Buffer up to HEADERLESS_SAMPLE rows (plus a possible header) so headerless files can be inferred,
        // but never more than the caller asked to scan.
        if (pending.length < Math.min(HEADERLESS_SAMPLE, maxRows) + 1) continue;
        flushPending();
        if (truncated) break;
        continue;
      }
      if (!consume(record, line)) break;
    }
    if (!columns && pending.length) flushPending();
    if (!columns) columns = mapColumns({ headerRow: null, sampleRows: [] });

    const warnings = [];
    if (!confident) warnings.push(CSV_WARNINGS.DELIMITER_UNCERTAIN);
    if (!headerRow) warnings.push(CSV_WARNINGS.NO_HEADER);
    if (!columns.businessId) warnings.push(CSV_WARNINGS.NO_BUSINESS_ID_COLUMN);
    if (!columns.name) warnings.push(CSV_WARNINGS.NO_NAME_COLUMN);
    if (stats.dataRows === 0) warnings.push(CSV_WARNINGS.NO_DATA_ROWS);
    if (stats.invalidBusinessIds > 0) warnings.push(CSV_WARNINGS.INVALID_BUSINESS_IDS);
    if (stats.duplicateBusinessIds > 0) warnings.push(CSV_WARNINGS.DUPLICATE_BUSINESS_IDS);
    if (stats.withNeither > 0) warnings.push(CSV_WARNINGS.ROWS_WITHOUT_KEYS);
    if (stats.raggedRows > 0) warnings.push(CSV_WARNINGS.RAGGED_ROWS);
    if (duplicateTracking === "partial") warnings.push(CSV_WARNINGS.DUPLICATE_CHECK_PARTIAL);
    if (truncated) warnings.push(CSV_WARNINGS.TRUNCATED);

    const usable = Boolean((columns.businessId || columns.name) && stats.dataRows > 0);

    return {
      usable,
      format: { delimiter, hasBom, hasHeader: Boolean(headerRow), columnCount: width ?? 0 },
      columns: {
        businessId: columns.businessId,
        name: columns.name,
        unmapped: columns.unmapped,
        headers: headerRow,
      },
      rows: { ...stats, scanned: stats.dataRows + stats.emptyRows, truncated },
      businessIds: { invalidExamples, duplicateExamples, duplicateTracking, reasons: Object.values(BUSINESS_ID_REASON) },
      samples,
      warnings,
    };
  };

  return { inspect };
};
