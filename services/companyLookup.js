import { normalizeName } from "../domain/names.js";
import { findLocalByName, findLocalCompany, saveApiCompanies } from "./companies.js";

/**
 * One place to find a company: the local register first, PRH's API only on a miss, and every API hit is
 * written through to the local register. Results are `companies` rows: { businessId, name, active, data, source, fetchedAt, ... }.
 */
export const createCompanyLookup = ({ ytj }) => ({
  /** @returns {Promise<object|null>} null when neither the register nor PRH knows the id. Throws YTJ_UNAVAILABLE if PRH is down. */
  async findByBusinessId(businessId) {
    const local = await findLocalCompany(businessId);
    if (local) return local;
    const raw = await ytj.findByBusinessId(businessId);
    if (!raw) return null;
    const [saved] = await saveApiCompanies([raw]);
    return saved;
  },

  /**
   * Exact match on the folded name (primary or alias). Local register first; on no hit, one PRH name search whose
   * results are written through and then filtered the same exact way. Returns 0, 1 or several candidates.
   */
  async findByName(name) {
    const nameNorm = normalizeName(name);
    if (!nameNorm) return [];
    const local = await findLocalByName(nameNorm);
    if (local.length) return local;
    const raws = await ytj.searchByName(name);
    if (!raws.length) return [];
    const saved = await saveApiCompanies(raws);
    return saved.filter((c) => c.nameNorm === nameNorm || c.altNamesNorm.includes(nameNorm));
  },
});
