import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProductPrice,
  createProductSchema,
  updatePriceSchema,
} from "./products.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/", authenticate, getProducts);
router.get("/:id", authenticate, getProductById);
router.post(
  "/",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  validateBody(createProductSchema),
  createProduct
);
router.post(
  "/:id/price",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  validateBody(updatePriceSchema),
  updateProductPrice
);

export const productRoutes = router;
