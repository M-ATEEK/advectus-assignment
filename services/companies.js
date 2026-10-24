import { normalizeCompany } from "../domain/normalizeCompany.js";
import { normalizeName } from "../domain/names.js";
import { COMPANY_SOURCE } from "../constants/jobs.js";
import { Company, sequelize } from "../models/index.js";

/** Raw PRH record → one companies row. */
export const toCompanyRow = (raw, { source, datasetVersionId = null, fetchedAt }) => {
  const data = normalizeCompany(raw);
  return {
    business_id: data.businessId,
    name: data.name,
    name_norm: data.name ? normalizeName(data.name) : null,
    alt_names_norm: [...data.parallelNames, ...data.auxiliaryNames].map(normalizeName).filter(Boolean),
    active: data.status.active,
    data,
    source,
    dataset_version_id: datasetVersionId,
    fetched_at: fetchedAt,
  };
};

const UPSERT_SQL = `
  INSERT INTO companies (business_id, name, name_norm, alt_names_norm, active, data, source, dataset_version_id, fetched_at)
  SELECT business_id, name, name_norm, alt_names_norm, active, data, source::enum_companies_source, dataset_version_id, fetched_at
  FROM jsonb_to_recordset($1::jsonb) AS t(
    business_id text, name text, name_norm text, alt_names_norm text[], active boolean,
    data jsonb, source text, dataset_version_id integer, fetched_at timestamptz
  )
  ON CONFLICT (business_id) DO UPDATE SET
    name = EXCLUDED.name, name_norm = EXCLUDED.name_norm, alt_names_norm = EXCLUDED.alt_names_norm,
    active = EXCLUDED.active, data = EXCLUDED.data, source = EXCLUDED.source,
    dataset_version_id = EXCLUDED.dataset_version_id, fetched_at = EXCLUDED.fetched_at`;

/** One statement per batch: the batch travels as a single JSON parameter, so no per-row escaping or placeholders. */
export const upsertCompanies = async (rows) => {
  if (rows.length === 0) return;
  await sequelize.query(UPSERT_SQL, { bind: [JSON.stringify(rows)] });
};

/** Local register lookup by business ID. */
export const findLocalCompany = async (businessId) => {
  const row = await Company.findByPk(businessId);
  return row ? row.get({ plain: true }) : null;
};

/** Stores raw PRH records fetched from the API so the next lookup is local. Returns the stored rows. */
export const saveApiCompanies = async (raws) => {
  const fetchedAt = new Date();
  const rows = raws.map((raw) => toCompanyRow(raw, { source: COMPANY_SOURCE.API, fetchedAt }));
  await upsertCompanies(rows);
  return rows.map((r) => ({ businessId: r.business_id, name: r.name, active: r.active, data: r.data, source: r.source, datasetVersionId: null, fetchedAt }));
};

/** Removes dump rows that an older load wrote and the new dump no longer contains. API-fetched rows are kept. */
export const deleteSupersededDumpRows = async (liveVersionId) => {
  const [, meta] = await sequelize.query(
    "DELETE FROM companies WHERE source = $1 AND dataset_version_id IS DISTINCT FROM $2",
    { bind: [COMPANY_SOURCE.DUMP, liveVersionId] },
  );
  return meta.rowCount;
};
