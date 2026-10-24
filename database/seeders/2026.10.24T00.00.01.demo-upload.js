import { copyFile, mkdir, stat, unlink, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import config from "../../config/index.js";
import { Upload } from "../../models/index.js";

/** A stable id so docs and scripts can refer to the demo upload. */
export const DEMO_UPLOAD_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE = new URL("../../data/sample-companies.csv", import.meta.url);

export const up = async () => {
  await mkdir(config.uploads.dir, { recursive: true });
  const target = path.resolve(config.uploads.dir, `${DEMO_UPLOAD_ID}.csv`);
  await copyFile(SOURCE, target);
  const [content, { size }] = await Promise.all([readFile(target), stat(target)]);
  await Upload.upsert({
    id: DEMO_UPLOAD_ID,
    fileName: "sample-companies.csv",
    contentType: "text/csv",
    bytes: size,
    sha256: createHash("sha256").update(content).digest("hex"),
    path: target,
    receivedAt: new Date(),
  });
};

export const down = async () => {
  await Upload.destroy({ where: { id: DEMO_UPLOAD_ID } });
  await unlink(path.resolve(config.uploads.dir, `${DEMO_UPLOAD_ID}.csv`)).catch(() => {});
};
