import { Router } from "express";
import { createDatasetController } from "../controllers/dataset.js";

export const createDatasetRouter = ({ dataset }) => {
  const router = Router();
  const controller = createDatasetController({ dataset });
  router.get("/dataset", controller.status);
  router.post("/dataset/refresh", controller.refresh);
  return router;
};
