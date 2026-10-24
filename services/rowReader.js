import { parseBusinessId } from "../domain/businessId.js";
import { detectHeader, mapColumns } from "../domain/columnMapping.js";
import { detectDelimiter, readRows, readSample } from "./csv.js";

const HEADERLESS_SAMPLE = 20;

const isEmptyRow = (cells) => cells.every((c) => c === "" || c === null || c === undefined);
const cell = (cells, col) => (col ? (cells[col.index] ?? "").trim() : "");

/**
 * Streams a CSV file as normalised input rows. The first item is `{ type: "meta" }` describing the
 * detected format and column mapping; every following item is `{ type: "row" }`.
 * Empty rows are yielded with `empty: true` so callers can count them; `rowNumber` counts data rows only.
 * Stops after `maxRows` yielded rows (data + empty).
 */
export async function* readInputRows(filePath, { maxRows = Infinity } = {}) {
  const { text, hasBom } = await readSample(filePath);
  const { delimiter, confident } = detectDelimiter(text);

  let meta = null;
  let rowNumber = 0;
  let yielded = 0;
  const pending = [];

  const toRow = (cells, line) => {
    if (isEmptyRow(cells)) return { type: "row", line, cells, empty: true, ragged: false, businessId: null, name: null };
    rowNumber++;
    const rawId = cell(cells, meta.columns.businessId);
    const name = cell(cells, meta.columns.name) || null;
    return {
      type: "row",
      rowNumber,
      line,
      cells,
      empty: false,
      ragged: cells.length !== meta.width,
      businessId: rawId ? { input: rawId, ...parseBusinessId(rawId) } : null,
      name,
    };
  };

  const buildMeta = (firstRows) => {
    const hasHeader = firstRows.length > 0 && detectHeader(firstRows[0]);
    const headerRow = hasHeader ? firstRows[0] : null;
    const columns = mapColumns({ headerRow, sampleRows: hasHeader ? firstRows.slice(1) : firstRows });
    const width = headerRow ? headerRow.length : Math.max(0, ...firstRows.map((r) => r.length));
    return { type: "meta", delimiter, delimiterConfident: confident, hasBom, hasHeader, headerRow, columns, width };
  };

  async function* flushPending() {
    meta = buildMeta(pending.map((p) => p.cells));
    yield meta;
    const dataRows = meta.hasHeader ? pending.slice(1) : pending;
    for (const { cells, line } of dataRows) {
      if (yielded >= maxRows) return;
      yielded++;
      yield toRow(cells, line);
    }
    pending.length = 0;
  }

  for await (const { record, info } of readRows(filePath, { delimiter })) {
    if (!meta) {
      pending.push({ cells: record, line: info.lines });
      if (pending.length < Math.min(HEADERLESS_SAMPLE, maxRows) + 1) continue;
      yield* flushPending();
      if (yielded >= maxRows) return;
      continue;
    }
    if (yielded >= maxRows) return;
    yielded++;
    yield toRow(record, info.lines);
  }
  if (!meta) yield* flushPending();
}
