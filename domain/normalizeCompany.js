import { ADDRESS_TYPE, DEFAULT_COUNTRY, INACTIVE_SITUATIONS, LANGUAGE, NAME_TYPE, REGISTERED_ENTRY, SITUATION } from "./codes.js";

const str = (v) => (v === null || v === undefined ? "" : String(v).trim());
const nullable = (v) => (str(v) === "" ? null : str(v));
const isCurrent = (item) => !item?.endDate;
const byRegistrationDesc = (a, b) => str(b.registrationDate).localeCompare(str(a.registrationDate));

/** [{languageCode, description}] → { fi, sv, en } */
const descriptions = (list = []) =>
  Object.fromEntries(list.filter((d) => LANGUAGE[d.languageCode] && d.description).map((d) => [LANGUAGE[d.languageCode], d.description]));

/** Current entry if there is one, otherwise the most recently registered. */
const currentOrLatest = (items = []) => items.find(isCurrent) ?? [...items].sort(byRegistrationDesc)[0] ?? null;

const codedDescription = (entry) => (entry ? { code: str(entry.type), ...descriptions(entry.descriptions) } : null);

const currentNames = (names, type) => names.filter((n) => str(n.type) === type && isCurrent(n)).map((n) => n.name);

/** "2026-10-23 06:26:49" (dump) and "2026-10-22T10:58:46" (API) → ISO-like "2026-10-23T06:26:49" */
const isoDateTime = (v) => (nullable(v) ? str(v).replace(" ", "T") : null);

const streetLine = (a) => {
  if (a.postOfficeBox) return `PL ${a.postOfficeBox}`;
  const number = [a.buildingNumber, a.entrance, a.apartmentNumber ? `${a.apartmentNumber}${a.apartmentIdSuffix ?? ""}` : ""]
    .map(str)
    .filter(Boolean)
    .join(" ");
  const line = [str(a.street), number].filter(Boolean).join(" ");
  return line || nullable(a.freeAddressLine);
};

const city = (a) => {
  const offices = a.postOffices ?? [];
  const preferred = offices.find((p) => str(p.languageCode) === "1") ?? offices[0];
  return preferred?.city ? titleCase(preferred.city) : null;
};

const titleCase = (s) => str(s).toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

const normalizeAddress = (a) =>
  a
    ? {
        street: streetLine(a),
        postCode: nullable(a.postCode),
        city: city(a),
        country: nullable(a.country) ?? DEFAULT_COUNTRY,
        careOf: nullable(a.co),
        parts: {
          street: nullable(a.street),
          buildingNumber: nullable(a.buildingNumber),
          entrance: nullable(a.entrance),
          apartmentNumber: nullable(a.apartmentNumber),
          postOfficeBox: nullable(a.postOfficeBox),
        },
        registrationDate: nullable(a.registrationDate),
      }
    : null;

const situation = (situations = []) => {
  const current = currentOrLatest(situations.filter(isCurrent));
  return current ? SITUATION[current.type] ?? str(current.type) : null;
};

/**
 * PRH YTJ v3 company (identical shape in the API and in the /all_companies dump) → NormalizedCompany.
 * Pure; never throws on missing arrays.
 */
export const normalizeCompany = (raw) => {
  const names = raw.names ?? [];
  const addresses = raw.addresses ?? [];
  const entries = raw.registeredEntries ?? [];
  const currentSituation = situation(raw.companySituations);
  const endDate = nullable(raw.endDate);

  return {
    businessId: str(raw.businessId?.value),
    euId: nullable(raw.euId?.value),
    name: currentNames(names, NAME_TYPE.PRIMARY)[0] ?? null,
    parallelNames: currentNames(names, NAME_TYPE.PARALLEL),
    auxiliaryNames: currentNames(names, NAME_TYPE.AUXILIARY),
    companyForm: codedDescription(currentOrLatest(raw.companyForms)),
    mainBusinessLine: codedDescription(raw.mainBusinessLine),
    status: {
      active: !endDate && !INACTIVE_SITUATIONS.includes(currentSituation),
      registered: str(raw.tradeRegisterStatus) === "1",
      ceasedAt: endDate,
      situation: currentSituation,
      codes: { status: nullable(raw.status), tradeRegisterStatus: nullable(raw.tradeRegisterStatus) },
    },
    vatLiable: entries.some((e) => str(e.type) === REGISTERED_ENTRY.VAT_BUSINESS && isCurrent(e)),
    addresses: {
      visiting: normalizeAddress(addresses.find((a) => str(a.type) === ADDRESS_TYPE.VISITING)),
      postal: normalizeAddress(addresses.find((a) => str(a.type) === ADDRESS_TYPE.POSTAL)),
    },
    website: nullable(raw.website?.url),
    registrationDate: nullable(raw.registrationDate),
    endDate,
    lastModified: isoDateTime(raw.lastModified),
  };
};
