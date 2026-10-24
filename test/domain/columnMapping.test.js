import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyHeader, detectHeader, foldHeader, mapColumns, COLUMN } from "../../domain/columnMapping.js";

test("foldHeader removes BOM, accents, case and punctuation", () => {
  assert.equal(foldHeader("﻿Y-tunnus"), "ytunnus");
  assert.equal(foldHeader("Yrityksen nimi"), "yrityksennimi");
  assert.equal(foldHeader("Företagsnamn"), "foretagsnamn");
  assert.equal(foldHeader(" Business_ID "), "businessid");
});

test("classifies Finnish, Swedish and English headers", () => {
  for (const h of ["Y-tunnus", "ytunnus", "business_id", "Business ID", "VAT number", "FO-nummer", "Org.nr"]) {
    assert.equal(classifyHeader(h), COLUMN.BUSINESS_ID, h);
  }
  for (const h of ["Name", "company_name", "Company", "Yritys", "Yrityksen nimi", "Nimi", "Företagsnamn", "Asiakas"]) {
    assert.equal(classifyHeader(h), COLUMN.NAME, h);
  }
  assert.equal(classifyHeader("Address"), null);
  assert.equal(classifyHeader("0112038-9"), null);
});

test("detectHeader is true only when a cell is a known alias", () => {
  assert.ok(detectHeader(["business_id", "company_name"]));
  assert.ok(detectHeader(["Address", "Nimi"]));
  assert.ok(!detectHeader(["0112038-9", "Nokia Oyj"]));
});

test("mapColumns with a header picks aliases and lists the rest as unmapped", () => {
  const map = mapColumns({ headerRow: ["Address", "Y-tunnus", "Yritys", "Notes"], sampleRows: [] });
  assert.deepEqual(map.businessId, { index: 1, header: "Y-tunnus" });
  assert.deepEqual(map.name, { index: 2, header: "Yritys" });
  assert.deepEqual(map.unmapped.map((u) => u.index), [0, 3]);
});

test("mapColumns without a header infers from the data", () => {
  const map = mapColumns({
    headerRow: null,
    sampleRows: [
      ["Nokia Oyj", "0112038-9", "Espoo"],
      ["KONE Oyj", "1927400-1", "Helsinki"],
      ["Tikkurila Oyj", "", "Vantaa"],
    ],
  });
  assert.equal(map.businessId.index, 1);
  assert.equal(map.name.index, 0);
  assert.deepEqual(map.unmapped.map((u) => u.index), [2]);
});

test("mapColumns on a single headerless name column", () => {
  const map = mapColumns({ headerRow: null, sampleRows: [["Nokia Oyj"], ["KONE Oyj"]] });
  assert.equal(map.businessId, null);
  assert.equal(map.name.index, 0);
});
