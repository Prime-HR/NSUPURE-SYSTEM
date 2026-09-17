import { Router } from "express";
import { getAuditLogs } from "./audit.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";

const router = Router();

router.get(
  "/",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  getAuditLogs
);

export const auditRoutes = router;
