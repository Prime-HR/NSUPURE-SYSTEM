import { Router } from "express";
import {
  getProductionRuns, restoreProductionRun, updateProductionRun, voidProductionRun, getProductionHistory, updateProductionRunSchema, voidProductionRunSchema,
  createProductionRun,
  getBatches,
  recordWaste,
  createProductionRunSchema,
  recordWasteSchema,
} from "./production.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

import { requireRoles } from "../../middleware/rbac.js";

const router = Router();
const editors = requireRoles("OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR");
router.put("/runs/:id", authenticate, editors, validateBody(updateProductionRunSchema), updateProductionRun);
router.post("/runs/:id/void", authenticate, editors, validateBody(voidProductionRunSchema), voidProductionRun);
router.post("/runs/:id/restore", authenticate, editors, validateBody(voidProductionRunSchema), restoreProductionRun);
router.get("/runs/:id/history", authenticate, editors, getProductionHistory);

router.get("/runs", authenticate, getProductionRuns);
router.post("/runs", authenticate, editors, validateBody(createProductionRunSchema), createProductionRun);

router.get("/batches", authenticate, getBatches);
router.post("/waste", authenticate, validateBody(recordWasteSchema), recordWaste);

export const productionRoutes = router;
