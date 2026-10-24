/**
 * Code tables for the PRH YTJ v3 data. Descriptions for forms, industries and register entries are embedded
 * in every record in three languages, so only the codes PRH leaves undocumented are mapped here.
 * Values were confirmed against the full register dump of 2026-10-23 (465,408 companies).
 */
export const LANGUAGE = Object.freeze({ 1: "fi", 2: "sv", 3: "en" });

export const NAME_TYPE = Object.freeze({ PRIMARY: "1", PARALLEL: "2", AUXILIARY: "3" });

export const ADDRESS_TYPE = Object.freeze({ VISITING: "1", POSTAL: "2" });

/** registeredEntries.type 80 = "VAT-liable for business activity"; the only reliable VAT signal in the data. */
export const REGISTERED_ENTRY = Object.freeze({ VAT_BUSINESS: "80" });

/** companySituations.type → neutral English label. Descriptions are empty in the dump, so these are ours. */
export const SITUATION = Object.freeze({
  KONK: "bankruptcy",
  SELTILA: "liquidation",
  SANE: "restructuring",
});

/** Situations under which a company is not a going concern for customer-register purposes. */
export const INACTIVE_SITUATIONS = Object.freeze(["bankruptcy", "liquidation"]);

export const DEFAULT_COUNTRY = "FI";
