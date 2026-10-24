/**
 * Finnish business ID (Y-tunnus): 7 digits, hyphen, 1 check digit, e.g. 0112038-9.
 * Check digit: weights 7,9,10,5,8,4,2 over the 7 digits, sum mod 11 → 0 ⇒ 0, 1 ⇒ invalid, else 11 − remainder.
 */
const WEIGHTS = [7, 9, 10, 5, 8, 4, 2];
const CANONICAL = /^(\d{7})-(\d)$/;

export const BUSINESS_ID_REASON = Object.freeze({
  EMPTY: "EMPTY",
  FORMAT: "FORMAT",
  CHECKSUM: "CHECKSUM",
});

/** "FI01120389", " 0112038-9 ", "01120389" → "0112038-9". Returns null when the shape is not recognisable. */
export const normalizeBusinessId = (input) => {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().toUpperCase().replace(/\s+/g, "");
  if (s === "") return null;
  if (s.startsWith("FI")) s = s.slice(2);
  if (/^\d{8}$/.test(s)) s = `${s.slice(0, 7)}-${s.slice(7)}`;
  if (/^\d{1,6}-\d$/.test(s)) s = s.padStart(9, "0"); // leading zeros dropped by spreadsheets
  return CANONICAL.test(s) ? s : null;
};

export const computeCheckDigit = (sevenDigits) => {
  const sum = [...sevenDigits].reduce((acc, d, i) => acc + Number(d) * WEIGHTS[i], 0);
  const remainder = sum % 11;
  if (remainder === 0) return 0;
  if (remainder === 1) return null; // such a number can never be a valid business ID
  return 11 - remainder;
};

/**
 * @returns {{ valid: boolean, value: string|null, reason?: string }}
 *   value is the canonical form when the shape was recognisable, even if the checksum fails.
 */
export const parseBusinessId = (input) => {
  const raw = input === null || input === undefined ? "" : String(input).trim();
  if (raw === "") return { valid: false, value: null, reason: BUSINESS_ID_REASON.EMPTY };
  const value = normalizeBusinessId(raw);
  if (!value) return { valid: false, value: null, reason: BUSINESS_ID_REASON.FORMAT };
  const [, digits, check] = CANONICAL.exec(value);
  if (computeCheckDigit(digits) !== Number(check)) return { valid: false, value, reason: BUSINESS_ID_REASON.CHECKSUM };
  return { valid: true, value };
};

export const isValidBusinessId = (input) => parseBusinessId(input).valid;

/** Heuristic used for headerless CSVs: does this cell look like it was meant to be a business ID? */
export const looksLikeBusinessId = (cell) => /^\s*(FI)?\d{6,8}(-\d)?\s*$/i.test(String(cell ?? ""));
