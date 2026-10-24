import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import yauzl from "yauzl";
import streamArray from "stream-json/streamers/stream-array.js";
import { ApiError } from "../utils/ApiError.js";
import { ERRORS } from "../constants/messages.js";

export const sha256File = async (filePath) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
};

/** Opens the first entry of the PRH ZIP and returns its name plus a readable stream of the JSON inside. */
const openFirstEntry = (zipPath) =>
  new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(ApiError.from(ERRORS.DATASET_ZIP_INVALID, { params: { reason: err.message }, cause: err }));
      zip.once("entry", (entry) =>
        zip.openReadStream(entry, (streamErr, stream) =>
          streamErr ? reject(streamErr) : resolve({ entryName: entry.fileName, stream, uncompressedSize: entry.uncompressedSize }),
        ),
      );
      zip.once("end", () => reject(ApiError.from(ERRORS.DATASET_ZIP_INVALID, { params: { reason: "archive is empty" } })));
      zip.readEntry();
    });
  });

/** "data_20261023.json" → "2026-10-23"; null when the name does not carry a date. */
export const generatedDateFromName = (entryName) => {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(entryName ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/**
 * Streams the companies in a PRH /all_companies ZIP one at a time, without loading the 1.5 GB JSON array.
 * @returns {Promise<{entryName: string, uncompressedSize: number, records: AsyncIterable<object>}>}
 */
export const openDump = async (zipPath) => {
  const { entryName, stream, uncompressedSize } = await openFirstEntry(zipPath);
  const records = (async function* () {
    // withParserAsStream = JSON tokenizer + array element assembler as one Node Duplex: one company per item
    for await (const { value } of stream.pipe(streamArray.withParserAsStream())) yield value;
  })();
  return { entryName, uncompressedSize, records };
};
