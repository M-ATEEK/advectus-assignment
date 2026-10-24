import { Router } from "express";
import { createUploadController } from "../controllers/uploads.js";
import { createUploadValidator } from "../validators/uploads.js";
import { validate } from "../middleware/validate.js";

export const createUploadsRouter = ({ uploads }) => {
  const router = Router();
  const controller = createUploadController({ uploads });

  router.post("/uploads", createUploadValidator(), validate, controller.create);

  return router;
};
