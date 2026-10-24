import { Router } from "express";
import { createUploadController } from "../controllers/uploads.js";
import { createInspectValidator, createUploadValidator } from "../validators/uploads.js";
import { validate } from "../middleware/validate.js";

export const createUploadsRouter = ({ uploads, inspector }) => {
  const router = Router();
  const controller = createUploadController({ uploads, inspector });

  router.post("/uploads", createUploadValidator(), validate, controller.create);
  router.get("/uploads/:id/inspect", createInspectValidator(), validate, controller.inspect);

  return router;
};
