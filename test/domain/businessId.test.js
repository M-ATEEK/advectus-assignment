import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBusinessId,
  computeCheckDigit,
  parseBusinessId,
  isValidBusinessId,
  looksLikeBusinessId,
  BUSINESS_ID_REASON,
} from "../../domain/businessId.js";

test("normalizes the common spellings to canonical form", () => {
  for (const input of ["0112038-9", " 0112038-9 ", "FI01120389", "fi0112038-9", "01120389", "112038-9", "0112038 - 9"]) {
    assert.equal(normalizeBusinessId(input), "0112038-9", input);
  }
});

test("returns null for shapes that are not a business ID", () => {
  for (const input of ["", "   ", null, undefined, "ABC-123", "0112038", "0112038-99", "0112038-X", "Nokia Oyj"]) {
    assert.equal(normalizeBusinessId(input), null, String(input));
  }
});

test("check digit follows the official weights 7,9,10,5,8,4,2", () => {
  assert.equal(computeCheckDigit("0112038"), 9);
  assert.equal(computeCheckDigit("1927400"), 1);
  assert.equal(computeCheckDigit("1234567"), 1);
  assert.equal(computeCheckDigit("0000006"), null, "remainder 1 can never be valid");
});

test("parseBusinessId distinguishes empty, format and checksum failures", () => {
  assert.deepEqual(parseBusinessId(""), { valid: false, value: null, reason: BUSINESS_ID_REASON.EMPTY });
  assert.deepEqual(parseBusinessId("ABC-123"), { valid: false, value: null, reason: BUSINESS_ID_REASON.FORMAT });
  assert.deepEqual(parseBusinessId("0112038-8"), { valid: false, value: "0112038-8", reason: BUSINESS_ID_REASON.CHECKSUM });
  assert.deepEqual(parseBusinessId("0000006-0"), { valid: false, value: "0000006-0", reason: BUSINESS_ID_REASON.CHECKSUM });
  assert.deepEqual(parseBusinessId("FI01120389"), { valid: true, value: "0112038-9" });
});

test("known public business IDs validate", () => {
  for (const id of ["0112038-9", "1927400-1", "1463611-4", "1852302-9", "0109862-8", "1041090-0", "0773744-3", "0116510-6", "0142213-3", "1234567-1"]) {
    assert.ok(isValidBusinessId(id), id);
  }
});

test("looksLikeBusinessId is a loose shape test for headerless files", () => {
  assert.ok(looksLikeBusinessId("0112038-9"));
  assert.ok(looksLikeBusinessId("FI01120389"));
  assert.ok(looksLikeBusinessId(" 112038-9 "));
  assert.ok(!looksLikeBusinessId("Nokia Oyj"));
  assert.ok(!looksLikeBusinessId("2026-10-24"));
});
