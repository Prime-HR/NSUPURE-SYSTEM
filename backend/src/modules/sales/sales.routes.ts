import { Router } from "express";
import {
  getSales,
  getSaleById,
  createSale,
  voidSale,
  createSaleSchema,
  voidSaleSchema,
} from "./sales.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/", authenticate, getSales);
router.get("/:id", authenticate, getSaleById);
router.post("/", authenticate, validateBody(createSaleSchema), createSale);
router.post(
  "/:id/void",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR", "MANAGER"),
  validateBody(voidSaleSchema),
  voidSale
);

export const saleRoutes = router;
