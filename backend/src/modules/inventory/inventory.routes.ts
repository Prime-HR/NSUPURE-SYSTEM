import { Router } from "express";
import {
  getInventoryItems,
  createInventoryItem,
  recordInventoryTransaction,
  getSuppliers,
  createSupplier,
  createPurchase,
  createItemSchema,
  recordTransactionSchema,
  createSupplierSchema,
  createPurchaseSchema,
} from "./inventory.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

// Inventory items & stock movements
router.get("/items", authenticate, getInventoryItems);
router.post("/items", authenticate, validateBody(createItemSchema), createInventoryItem);
router.post("/transactions", authenticate, validateBody(recordTransactionSchema), recordInventoryTransaction);

// Suppliers & Purchases
router.get("/suppliers", authenticate, getSuppliers);
router.post("/suppliers", authenticate, validateBody(createSupplierSchema), createSupplier);
router.post("/purchases", authenticate, validateBody(createPurchaseSchema), createPurchase);

export const inventoryRoutes = router;
