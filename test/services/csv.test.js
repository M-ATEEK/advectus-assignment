import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectDelimiter, readRows, readSample } from "../../services/csv.js";

let dir;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "advectus-csv-"));
});
after(() => rm(dir, { recursive: true, force: true }));

test("detectDelimiter picks the most frequent delimiter of the first line", () => {
  assert.deepEqual(detectDelimiter("a;b;c\n1;2;3"), { delimiter: ";", confident: true });
  assert.deepEqual(detectDelimiter("a,b,c\n1,2,3"), { delimiter: ",", confident: true });
  assert.deepEqual(detectDelimiter("a\tb\n1\t2"), { delimiter: "\t", confident: true });
  assert.deepEqual(detectDelimiter("﻿id|name\n"), { delimiter: "|", confident: true });
  assert.deepEqual(detectDelimiter("\n\nonlyonecolumn\n"), { delimiter: ";", confident: false });
  assert.deepEqual(detectDelimiter('"Nokia, Oyj";0112038-9'), { delimiter: ";", confident: true }, "quoted comma loses to the real delimiter");
});

test("readRows handles BOM, CRLF, quotes and ragged rows", async () => {
  const file = path.join(dir, "mixed.csv");
  await writeFile(file, '﻿business_id;company_name\r\n0112038-9;"Nokia; Oyj"\r\n;Tikkurila Oyj\r\n1927400-1\r\n\r\n', "utf8");
  const sample = await readSample(file);
  assert.equal(sample.hasBom, true);

  const rows = [];
  for await (const { record, info } of readRows(file, { delimiter: ";" })) rows.push({ record, line: info.lines });
  assert.deepEqual(rows[0].record, ["business_id", "company_name"]);
  assert.deepEqual(rows[1].record, ["0112038-9", "Nokia; Oyj"]);
  assert.deepEqual(rows[2].record, ["", "Tikkurila Oyj"]);
  assert.deepEqual(rows[3].record, ["1927400-1"]);
  assert.deepEqual(rows[4].record, [""]);
  assert.deepEqual(rows.map((r) => r.line), [1, 2, 3, 4, 5]);
});
