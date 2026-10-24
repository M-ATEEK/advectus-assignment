import { Router } from "express";
import { createEnrichmentController } from "../controllers/enrichments.js";
import { createEnrichmentValidator, enrichmentIdValidator, listRowsValidator } from "../validators/enrichments.js";
import { validate } from "../middleware/validate.js";

export const createEnrichmentsRouter = ({ enrichments }) => {
  const router = Router();
  const controller = createEnrichmentController({ enrichments });

  router.post("/enrichments", createEnrichmentValidator(), validate, controller.create);
  router.get("/enrichments/:id", enrichmentIdValidator(), validate, controller.get);
  router.get("/enrichments/:id/rows", listRowsValidator(), validate, controller.listRows);
  router.get("/enrichments/:id/results", listRowsValidator(), validate, controller.listResults);

  return router;
};
