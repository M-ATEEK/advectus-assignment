/**
 * NormalizedCompany → CustomerRecord: a NetSuite-flavoured customer that any register import can consume.
 * Field-by-field reasoning lives in docs/customer-mapping.md; keep the two in sync.
 */
const ENTITY_STATUS = Object.freeze({ ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" });

/** Finnish VAT number = "FI" + the business ID digits. Only meaningful for VAT-registered companies. */
export const vatNumberFor = (businessId) => `FI${businessId.replace("-", "")}`;

const toAddress = (address, { label, defaultBilling = false, defaultShipping = false }) => ({
  label,
  defaultBilling,
  defaultShipping,
  addr1: address.street,
  ...(address.careOf ? { addr2: `c/o ${address.careOf}` } : {}),
  zip: address.postCode,
  city: address.city,
  country: address.country,
});

/** Postal → billing, visiting → shipping. When only one exists it plays both roles. */
const addressbook = ({ visiting, postal }) => {
  if (postal && visiting) {
    return [
      toAddress(postal, { label: "Billing", defaultBilling: true }),
      toAddress(visiting, { label: "Shipping", defaultShipping: true }),
    ];
  }
  const only = postal ?? visiting;
  return only ? [toAddress(only, { label: "Primary", defaultBilling: true, defaultShipping: true })] : [];
};

/**
 * @param {object} company      NormalizedCompany
 * @param {object} [options]
 * @param {{source?: string, fetchedAt?: string, datasetVersion?: number|string}} [options.provenance]
 * @param {{subsidiary?: string, currency?: string}} [options.defaults]  register-specific constants
 */
export const mapCustomer = (company, { provenance = {}, defaults = {} } = {}) => ({
  externalId: company.businessId,
  companyName: company.name,
  altName: company.parallelNames[0] ?? company.auxiliaryNames[0] ?? null,
  isPerson: false,
  vatRegistrationNumber: company.vatLiable ? vatNumberFor(company.businessId) : null,
  entityStatus: company.status.active ? ENTITY_STATUS.ACTIVE : ENTITY_STATUS.INACTIVE,
  industryCode: company.mainBusinessLine?.code ?? null,
  industry: company.mainBusinessLine?.en ?? company.mainBusinessLine?.fi ?? null,
  companyFormCode: company.companyForm?.code ?? null,
  companyForm: company.companyForm?.en ?? company.companyForm?.fi ?? null,
  subsidiary: defaults.subsidiary ?? "FI",
  currency: defaults.currency ?? "EUR",
  url: company.website,
  addressbook: addressbook(company.addresses),
  custentity_ytj_business_id: company.businessId,
  custentity_ytj_situation: company.status.situation,
  custentity_ytj_last_modified: company.lastModified,
  custentity_ytj_source: provenance.source ?? null,
  custentity_ytj_fetched_at: provenance.fetchedAt ?? null,
  custentity_ytj_dataset_version: provenance.datasetVersion ?? null,
});
