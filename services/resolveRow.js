import config from "../config/index.js";
import { MATCH_CONFIDENCE, ROW_STATUS, ROW_WARNING } from "../constants/jobs.js";
import { mapCustomer } from "../domain/mapCustomer.js";
import { normalizeName } from "../domain/names.js";

const hasName = (company, name) => {
  const wanted = normalizeName(name);
  return company.nameNorm === wanted || (company.altNamesNorm ?? []).includes(wanted);
};

const matched = (company, confidence, warnings) => ({
  status: ROW_STATUS.MATCHED,
  result: {
    confidence,
    warnings,
    company: company.data,
    customer: mapCustomer(company.data, {
      provenance: { source: company.source, fetchedAt: company.fetchedAt, datasetVersion: company.datasetVersionId },
      defaults: config.customer,
    }),
  },
});

const toCandidate = (c) => ({
  businessId: c.businessId,
  name: c.name,
  active: c.active,
  companyForm: c.data.companyForm?.en ?? null,
  city: c.data.addresses?.postal?.city ?? c.data.addresses?.visiting?.city ?? null,
});

/** Several exact hits: prefer the active ones; if exactly one remains it is the match, otherwise ask a human. */
const byName = (candidates, warnings) => {
  if (candidates.length === 0) return { status: ROW_STATUS.NOT_FOUND, result: { warnings } };
  const active = candidates.filter((c) => c.active);
  const pool = active.length ? active : candidates;
  if (pool.length === 1) return matched(pool[0], MATCH_CONFIDENCE.NAME_EXACT, warnings);
  return { status: ROW_STATUS.AMBIGUOUS, result: { warnings, candidates: pool.map(toCandidate) } };
};

/**
 * Decides what one CSV row becomes. `input` is the stored row input: { businessId: {normalized, valid, ...} | null, name }.
 * Returns { status, result?, error? } ready to be written to job_rows.
 */
export const resolveRow = async (input, lookup) => {
  const warnings = [];
  const { businessId, name } = input;

  try {
    if (businessId?.valid) {
      const company = await lookup.findByBusinessId(businessId.normalized);
      if (company) {
        if (name && !hasName(company, name)) warnings.push(ROW_WARNING.NAME_MISMATCH);
        return matched(company, MATCH_CONFIDENCE.BUSINESS_ID, warnings);
      }
      if (!name) return { status: ROW_STATUS.NOT_FOUND, result: { warnings } };
      warnings.push(ROW_WARNING.ID_NOT_FOUND_USED_NAME);
    } else if (businessId) {
      warnings.push(ROW_WARNING.INVALID_BUSINESS_ID);
    }

    if (!name) return { status: ROW_STATUS.INVALID, result: { warnings } };
    return byName(await lookup.findByName(name), warnings);
  } catch (err) {
    if (err.code === "YTJ_UNAVAILABLE") {
      return { status: ROW_STATUS.PENDING, result: { warnings: [...warnings, ROW_WARNING.PRH_UNAVAILABLE] }, error: err.message };
    }
    return { status: ROW_STATUS.ERROR, result: { warnings }, error: err.message };
  }
};
