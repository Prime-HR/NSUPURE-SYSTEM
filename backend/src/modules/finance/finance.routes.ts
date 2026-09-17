import { Router } from "express";
import {
  getExpenses,
  createExpense,
  getCashbook,
  performCashCount,
  recordOwnerTransaction,
  getCostPerBag,
  createExpenseSchema,
  cashReconciliationSchema,
  ownerTransactionSchema,
} from "./finance.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

// Expenses
router.get("/expenses", authenticate, getExpenses);
router.post("/expenses", authenticate, validateBody(createExpenseSchema), createExpense);

// Cashbook
router.get("/cashbook", authenticate, getCashbook);
router.post(
  "/cashbook/count",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR", "FINANCE", "MANAGER"),
  validateBody(cashReconciliationSchema),
  performCashCount
);

// Owner Capital vs Drawings
router.post(
  "/owner-transaction",
  authenticate,
  requireRoles("OWNER"),
  validateBody(ownerTransactionSchema),
  recordOwnerTransaction
);

// Operating Cost per Bag
router.get("/cost-per-bag", authenticate, getCostPerBag);

export const financeRoutes = router;
