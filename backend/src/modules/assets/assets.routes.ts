import { Router } from "express";
import {
  getAssets,
  createAsset,
  recordAssetMaintenance,
  getLoans,
  createLoan,
  recordLoanPayment,
  createAssetSchema,
  recordAssetMaintenanceSchema,
  createLoanSchema,
  recordLoanPaymentSchema,
} from "./assets.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

// Assets
router.get("/", authenticate, getAssets);
router.post(
  "/",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR", "MANAGER"),
  validateBody(createAssetSchema),
  createAsset
);
router.post(
  "/maintenance",
  authenticate,
  validateBody(recordAssetMaintenanceSchema),
  recordAssetMaintenance
);

// Loans & Debt
router.get("/loans", authenticate, requireRoles("OWNER", "ADMINISTRATOR", "FINANCE"), getLoans);
router.post(
  "/loans",
  authenticate,
  requireRoles("OWNER"),
  validateBody(createLoanSchema),
  createLoan
);
router.post(
  "/loans/pay",
  authenticate,
  requireRoles("OWNER", "FINANCE"),
  validateBody(recordLoanPaymentSchema),
  recordLoanPayment
);

export const assetRoutes = router;
