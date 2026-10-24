import { ApiError } from "../utils/ApiError.js";
import { ERRORS, MESSAGES } from "../constants/messages.js";
import { sendCreated, sendSuccess } from "../utils/apiResponse.js";
import { readSingleFile } from "../services/multipart.js";
import { MULTIPART, baseContentType } from "../validators/uploads.js";

/** Shapes a stored upload for the API; internal fields such as `path` never leave the server. */
const toUploadDto = ({ id, fileName, contentType, bytes, sha256, receivedAt }) => ({
  id,
  fileName,
  contentType,
  bytes,
  sha256,
  receivedAt,
});

export const createUploadController = ({ uploads, inspector }) => ({
  /** POST /uploads — multipart/form-data with a "file" part, or a raw CSV body. */
  create: async (req, res) => {
    const contentType = baseContentType(req.headers["content-type"]);

    const upload =
      contentType === MULTIPART
        ? await readSingleFile(req, {
            consume: (stream, info) => uploads.save(stream, { originalName: info.fileName, contentType: info.contentType }),
          })
        : await uploads.save(req, {
            originalName: req.headers["x-file-name"] ? decodeURIComponent(req.headers["x-file-name"]) : null,
            contentType,
          });

    req.log.info({ uploadId: upload.id, bytes: upload.bytes }, "csv uploaded");
    return sendCreated(res, {
      message: MESSAGES.UPLOAD_RECEIVED,
      data: { upload: toUploadDto(upload) },
      location: `${req.baseUrl}/uploads/${upload.id}`,
    });
  },

  /** GET /uploads/:id/inspect — what the pipeline would understand from the stored CSV. */
  inspect: async (req, res) => {
    const upload = await uploads.find(req.params.id);
    if (!upload) throw ApiError.from(ERRORS.UPLOAD_NOT_FOUND, { params: { id: req.params.id } });

    const { maxRows, sampleSize } = req.query;
    const inspection = await inspector.inspect(upload.path, { maxRows, sampleSize });

    return sendSuccess(res, {
      message: MESSAGES.UPLOAD_INSPECTED,
      data: { upload: toUploadDto(upload), inspection },
    });
  },
});
