import { MESSAGES } from "../constants/messages.js";
import { sendCreated } from "../utils/apiResponse.js";
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

export const createUploadController = ({ uploads }) => ({
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
});
