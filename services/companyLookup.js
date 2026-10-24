import { findLocalCompany, saveApiCompanies } from "./companies.js";

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

  /** @returns {Promise<object[]>} PRH name-search hits, all written through to the local register. */
  async searchByNameRemote(name) {
    const raws = await ytj.searchByName(name);
    return raws.length ? saveApiCompanies(raws) : [];
  },
});
