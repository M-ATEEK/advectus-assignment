import Busboy from "busboy";
import { PassThrough } from "node:stream";
import { ApiError } from "../utils/ApiError.js";
import { ERRORS } from "../constants/messages.js";
import { CSV_CONTENT_TYPES, baseContentType } from "../validators/uploads.js";

const CSV_TYPES = new Set(CSV_CONTENT_TYPES);

/**
 * Extracts the single file part named `fieldName` from a multipart request as a stream and
 * passes it to `consume(stream, info)` while the request body is still arriving.
 * Resolves with whatever `consume` resolves. Rejects with catalogue ApiErrors only.
 */
export const readSingleFile = (req, { fieldName = "file", consume }) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn) => (value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    const ok = settle(resolve);
    const fail = settle(reject);

    let busboy;
    try {
      busboy = Busboy({ headers: req.headers, limits: { files: 1, fields: 5, fieldSize: 1024 } });
    } catch (err) {
      return fail(ApiError.from(ERRORS.UPLOAD_MALFORMED_MULTIPART, { params: { reason: err.message }, cause: err }));
    }

    let seenFile = false;
    busboy.on("file", (name, stream, info) => {
      seenFile = true;
      const type = baseContentType(info.mimeType);
      if (name !== fieldName) {
        stream.resume();
        return fail(ApiError.from(ERRORS.UPLOAD_UNEXPECTED_FIELD, { params: { field: name } }));
      }
      if (type && !CSV_TYPES.has(type)) {
        stream.resume();
        return fail(ApiError.from(ERRORS.UPLOAD_UNSUPPORTED_FILE_TYPE, { params: { type } }));
      }
      // PassThrough decouples busboy's part stream from the consumer's pipeline error handling.
      consume(stream.pipe(new PassThrough()), { fileName: info.filename, contentType: type || "text/csv" }).then(ok, fail);
    });
    busboy.on("filesLimit", () => fail(ApiError.from(ERRORS.UPLOAD_TOO_MANY_FILES)));
    busboy.on("error", (err) =>
      fail(ApiError.from(ERRORS.UPLOAD_MALFORMED_MULTIPART, { params: { reason: err.message }, cause: err })),
    );
    busboy.on("close", () => {
      if (!seenFile) fail(ApiError.from(ERRORS.UPLOAD_FILE_PART_MISSING));
    });

    req.pipe(busboy);
  });
