import { Router } from "express";
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getCustomerStatement,
  createCustomerSchema,
  updateCustomerSchema,
} from "./customers.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/", authenticate, getCustomers);
router.get("/:id", authenticate, getCustomerById);
router.get("/:id/statement", authenticate, getCustomerStatement);
router.post("/", authenticate, validateBody(createCustomerSchema), createCustomer);
router.put("/:id", authenticate, validateBody(updateCustomerSchema), updateCustomer);

export const customerRoutes = router;
