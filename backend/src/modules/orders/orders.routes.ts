import { Router } from "express";
import {
  getOrders,
  createOrder,
  updateOrderStatus,
  getRecurringOrders,
  createRecurringOrder,
  generateOrderFromRecurring,
  createOrderSchema,
  recurringOrderSchema,
} from "./orders.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/", authenticate, getOrders);
router.post("/", authenticate, validateBody(createOrderSchema), createOrder);
router.put("/:id/status", authenticate, updateOrderStatus);

// Recurring supply schedules
router.get("/recurring", authenticate, getRecurringOrders);
router.post("/recurring", authenticate, validateBody(recurringOrderSchema), createRecurringOrder);
router.post("/recurring/:id/generate", authenticate, generateOrderFromRecurring);

export const orderRoutes = router;
