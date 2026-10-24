import { looksLikeBusinessId } from "./businessId.js";

/** Header aliases (Finnish, Swedish, English), compared after folding to lowercase alphanumerics. */
const BUSINESS_ID_ALIASES = [
  "businessid", "business_id", "business id", "businessidentitycode", "bid", "yid",
  "ytunnus", "y-tunnus", "y_tunnus", "y tunnus", "yritystunnus", "fotunnus", "fo-nummer", "fonummer",
  "orgnr", "orgnummer", "organisationsnummer", "organizationnumber", "organisationnumber",
  "companyid", "company_id", "companynumber", "registrationnumber", "regno", "regnr",
  "vat", "vatid", "vatnumber", "vat_number", "alvtunnus", "alv", "alvnumero", "momsnummer",
];
const NAME_ALIASES = [
  "name", "companyname", "company_name", "company", "legalname", "businessname", "organisation", "organization",
  "customer", "customername", "client", "account", "accountname",
  "nimi", "yritys", "yrityksennimi", "yritysnimi", "toiminimi", "asiakas", "asiakkaannimi", "yhteisö", "yhteiso",
  "företag", "foretag", "företagsnamn", "foretagsnamn", "namn", "kund", "bolag",
];

export const COLUMN = Object.freeze({ BUSINESS_ID: "businessId", NAME: "name" });

export const foldHeader = (header) =>
  String(header ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const ID_SET = new Set(BUSINESS_ID_ALIASES.map(foldHeader));
const NAME_SET = new Set(NAME_ALIASES.map(foldHeader));

export const classifyHeader = (header) => {
  const key = foldHeader(header);
  if (ID_SET.has(key)) return COLUMN.BUSINESS_ID;
  if (NAME_SET.has(key)) return COLUMN.NAME;
  return null;
};

/** True when at least one header cell is a known alias; otherwise the first row is treated as data. */
export const detectHeader = (firstRow) => firstRow.some((cell) => classifyHeader(cell) !== null);

/**
 * Builds { businessId: {index, header}|null, name: {index, header}|null, unmapped: [{index, header}] }.
 * With a header row, aliases decide. Without one, sampled data rows decide:
 * the column where most cells look like business IDs becomes businessId, the first other text column becomes name.
 */
export const mapColumns = ({ headerRow, sampleRows }) => {
  const width = Math.max(headerRow?.length ?? 0, ...sampleRows.map((r) => r.length), 0);
  const result = { businessId: null, name: null, unmapped: [] };

  if (headerRow) {
    headerRow.forEach((header, index) => {
      const kind = classifyHeader(header);
      if (kind && !result[kind]) result[kind] = { index, header: String(header).trim() };
      else result.unmapped.push({ index, header: String(header).trim() });
    });
    return result;
  }

  const idScore = Array.from({ length: width }, () => 0);
  const textScore = Array.from({ length: width }, () => 0);
  for (const row of sampleRows) {
    row.forEach((cell, i) => {
      if (looksLikeBusinessId(cell)) idScore[i]++;
      else if (String(cell ?? "").trim() !== "") textScore[i]++;
    });
  }
  const idIndex = idScore.findIndex((s, i) => s > 0 && s >= textScore[i] && s === Math.max(...idScore));
  if (idIndex !== -1) result.businessId = { index: idIndex, header: null };
  const nameIndex = textScore.findIndex((s, i) => i !== idIndex && s > 0 && s === Math.max(...textScore.filter((_, j) => j !== idIndex)));
  if (nameIndex !== -1) result.name = { index: nameIndex, header: null };
  for (let i = 0; i < width; i++) {
    if (i !== idIndex && i !== nameIndex) result.unmapped.push({ index: i, header: null });
  }
  return result;
};
