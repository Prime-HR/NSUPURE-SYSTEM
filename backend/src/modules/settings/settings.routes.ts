import { Router } from "express";
import {
  getAllSettings,
  updateSettings,
  saveWizardStep,
  getWizardStatus,
  updateSettingsSchema,
  wizardStepSchema,
} from "./settings.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/", authenticate, getAllSettings);
router.put(
  "/",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  validateBody(updateSettingsSchema),
  updateSettings
);

router.get("/wizard/status", authenticate, getWizardStatus);
router.post(
  "/wizard/step",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  validateBody(wizardStepSchema),
  saveWizardStep
);

export const settingsRoutes = router;
