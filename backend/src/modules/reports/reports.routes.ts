import { Router } from "express";
import {
  getMonthlyManagementReport,
  getInvestorReport,
  getReadinessChecklist,
} from "./reports.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";

const router = Router();

router.get("/monthly-management", authenticate, getMonthlyManagementReport);
router.get("/monthly", authenticate, getMonthlyManagementReport);
router.get(
  "/investor-report",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR", "FINANCE"),
  getInvestorReport
);
router.get("/readiness-checklist", authenticate, getReadinessChecklist);

export const reportRoutes = router;
