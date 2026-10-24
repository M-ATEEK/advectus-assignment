import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ApiError } from "../utils/ApiError.js";
import { ERRORS } from "../constants/messages.js";
import { Upload } from "../models/index.js";

const ABORT_CODES = new Set(["ERR_STREAM_PREMATURE_CLOSE", "ECONNRESET"]);

/**
 * Stores an incoming CSV stream on disk without buffering it in memory.
 * Enforces a byte limit, rejects binary content, and computes a sha256 while streaming.
 * On any failure the partial file is removed.
 */
export const createUploadService = ({ dir, maxBytes, sniffBytes = 8192 }) => {
  const ensureDir = mkdir(dir, { recursive: true });
  const limitMb = Math.round(maxBytes / 1024 / 1024);

  const inspector = (state) =>
    new Transform({
      transform(chunk, _enc, cb) {
        state.bytes += chunk.length;
        if (state.bytes > maxBytes) return cb(ApiError.from(ERRORS.UPLOAD_TOO_LARGE, { params: { limitMb } }));
        if (!state.sniffed) {
          state.sniffed = true;
          if (chunk.subarray(0, sniffBytes).includes(0)) return cb(ApiError.from(ERRORS.UPLOAD_NOT_TEXT));
        }
        state.hash.update(chunk);
        cb(null, chunk);
      },
    });

  /**
   * @param {import('node:stream').Readable} source
   * @param {{originalName?: string|null, contentType?: string|null}} [meta]
   */
  const save = async (source, { originalName = null, contentType = null } = {}) => {
    await ensureDir;
    const id = randomUUID();
    const filePath = path.resolve(dir, `${id}.csv`);
    const state = { bytes: 0, sniffed: false, hash: createHash("sha256") };

    try {
      await pipeline(source, inspector(state), createWriteStream(filePath, { flags: "wx" }));
      if (state.bytes === 0) throw ApiError.from(ERRORS.UPLOAD_EMPTY);
    } catch (err) {
      await unlink(filePath).catch(() => {});
      if (ApiError.is(err)) throw err;
      if (ABORT_CODES.has(err.code)) throw ApiError.from(ERRORS.REQUEST_ABORTED, { cause: err });
      throw err;
    }

    try {
      const upload = await Upload.create({
        id,
        fileName: originalName,
        contentType,
        bytes: state.bytes,
        sha256: state.hash.digest("hex"),
        path: filePath,
        receivedAt: new Date(),
      });
      return upload.get({ plain: true });
    } catch (err) {
      await unlink(filePath).catch(() => {});
      throw err;
    }
  };

  /**
   * @returns {Promise<object|null>} the stored upload (including its server `path`), or null when unknown.
   * Throws UPLOAD_FILE_MISSING when the record exists but its file is gone from disk.
   */
  const find = async (id) => {
    const upload = await Upload.findByPk(id);
    if (!upload) return null;
    try {
      await access(upload.path);
    } catch {
      throw ApiError.from(ERRORS.UPLOAD_FILE_MISSING, { params: { id } });
    }
    return upload.get({ plain: true });
  };

  return { save, find, limitMb };
};
