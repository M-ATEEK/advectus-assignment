import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { parse } from "csv-parse";

export const DELIMITERS = [";", ",", "\t", "|"];
const BOM = "\uFEFF";

/** Picks the delimiter that occurs most in the first non-empty line (semicolon wins ties: Finnish Excel default). */
export const detectDelimiter = (sampleText) => {
  const firstLine = sampleText.replace(/^\uFEFF/, "").split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  let best = ";";
  let bestCount = -1;
  for (const d of DELIMITERS) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return { delimiter: best, confident: bestCount > 0 };
};

/** Reads the first `bytes` of a file as UTF-8 text, plus whether it starts with a BOM. */
export const readSample = async (filePath, bytes = 64 * 1024) => {
  const fh = await open(filePath, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    const text = buf.subarray(0, bytesRead).toString("utf8");
    return { text, hasBom: text.startsWith(BOM) };
  } finally {
    await fh.close();
  }
};

/**
 * Streams a CSV file as arrays of cells. Tolerates BOM, CRLF, quoted fields and ragged rows.
 * `info` on each yielded record carries the 1-based physical line number.
 */
export const readRows = (filePath, { delimiter }) =>
  createReadStream(filePath).pipe(
    parse({
      delimiter,
      bom: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: false,
      skip_records_with_empty_values: false,
      info: true,
    }),
  );
