import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Op } from "sequelize";
import config from "../config/index.js";
import { COMPANY_SOURCE, DATASET_STATUS, JOB_NAMES } from "../constants/jobs.js";
import { ERRORS } from "../constants/messages.js";
import { ApiError } from "../utils/ApiError.js";
import { DatasetVersion } from "../models/index.js";
import { generatedDateFromName, openDump, sha256File } from "../services/dumpReader.js";
import { deleteSupersededDumpRows, toCompanyRow, upsertCompanies } from "../services/companies.js";

const BATCH = 1000;
/** Real records average ~3.1 KB; a file with less than this per expected record is rejected before any row is written. */
const MIN_BYTES_PER_RECORD = 500;
const STALE_LOADING_MS = 2 * 60 * 60 * 1000;

/** Downloads the PRH ZIP to the dumps directory and returns its path. */
const download = async (url, dir) => {
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, `all_companies_${new Date().toISOString().slice(0, 10)}.zip`);
  const res = await fetch(url, { headers: { "user-agent": "advectus-assignment/0.1 (business-id enrichment)" } });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} from ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  return target;
};

/** A load still marked `loading` and younger than two hours blocks a second concurrent load. */
const findRunningLoad = () =>
  DatasetVersion.findOne({
    where: { status: DATASET_STATUS.LOADING, startedAt: { [Op.gt]: new Date(Date.now() - STALE_LOADING_MS) } },
  });

/**
 * Loads the PRH register into the companies table.
 * data: { source: "url" | "file", path?: string, minRecords?: number }
 * Rows are upserted in batches, so the table stays queryable while loading; dump rows missing from the new
 * file are deleted at the end. Same file as the live version (by sha256) → recorded as `unchanged`, nothing written.
 */
export const loadDatasetJob = {
  name: JOB_NAMES.LOAD_DATASET,

  async handle({ source = "url", path: filePath, minRecords = config.dataset.minRecords } = {}, { log }) {
    const running = await findRunningLoad();
    if (running) throw ApiError.from(ERRORS.DATASET_REFRESH_IN_PROGRESS, { params: { startedAt: running.startedAt.toISOString() } });

    const version = await DatasetVersion.create({ source: source === "file" ? filePath : config.dataset.url });
    try {
      const zipPath = source === "file" ? filePath : await download(config.dataset.url, config.dataset.dir);
      const sha256 = await sha256File(zipPath);

      const live = await DatasetVersion.findOne({ where: { status: DATASET_STATUS.LIVE } });
      if (live?.sha256 === sha256) {
        await version.update({ status: DATASET_STATUS.UNCHANGED, sha256, finishedAt: new Date() });
        log.info({ versionId: version.id }, "dataset unchanged");
        return { status: DATASET_STATUS.UNCHANGED, versionId: version.id };
      }

      const { entryName, uncompressedSize, records } = await openDump(zipPath);
      if (uncompressedSize < minRecords * MIN_BYTES_PER_RECORD) {
        throw ApiError.from(ERRORS.DATASET_FILE_TOO_SMALL, { params: { bytes: uncompressedSize, minRecords } });
      }
      const generatedAt = generatedDateFromName(entryName);
      const fetchedAt = generatedAt ? new Date(generatedAt) : new Date();
      await version.update({ sha256, fileName: entryName, generatedAt });

      let count = 0;
      let batch = [];
      for await (const raw of records) {
        batch.push(toCompanyRow(raw, { source: COMPANY_SOURCE.DUMP, datasetVersionId: version.id, fetchedAt }));
        if (batch.length === BATCH) {
          await upsertCompanies(batch);
          count += batch.length;
          batch = [];
          if (count % 50_000 === 0) log.info({ count }, "loading dataset");
        }
      }
      await upsertCompanies(batch);
      count += batch.length;

      if (count < minRecords) throw ApiError.from(ERRORS.DATASET_TOO_SMALL, { params: { count, min: minRecords } });

      const deleted = await deleteSupersededDumpRows(version.id);
      await DatasetVersion.update({ status: DATASET_STATUS.SUPERSEDED }, { where: { status: DATASET_STATUS.LIVE } });
      await version.update({ status: DATASET_STATUS.LIVE, recordCount: count, finishedAt: new Date() });
      log.info({ versionId: version.id, count, deleted, generatedAt }, "dataset live");
      return { status: DATASET_STATUS.LIVE, versionId: version.id, recordCount: count, deleted };
    } catch (err) {
      await version.update({ status: DATASET_STATUS.FAILED, error: err.message, finishedAt: new Date() });
      throw err;
    }
  },
};
