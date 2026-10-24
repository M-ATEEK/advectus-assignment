import { readFileSync } from "node:fs";

/** Loads test/fixtures/ytj/<name>.json (real PRH records: API capture and slices of the register dump). */
export const ytjFixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/ytj/${name}.json`, import.meta.url), "utf8"));
