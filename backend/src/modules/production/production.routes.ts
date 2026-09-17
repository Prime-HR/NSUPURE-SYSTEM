import { Router } from "express";
import {
  getProductionRuns,
  createProductionRun,
  getBatches,
  recordWaste,
  createProductionRunSchema,
  recordWasteSchema,
} from "./production.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/runs", authenticate, getProductionRuns);
router.post("/runs", authenticate, validateBody(createProductionRunSchema), createProductionRun);

router.get("/batches", authenticate, getBatches);
router.post("/waste", authenticate, validateBody(recordWasteSchema), recordWaste);

export const productionRoutes = router;
