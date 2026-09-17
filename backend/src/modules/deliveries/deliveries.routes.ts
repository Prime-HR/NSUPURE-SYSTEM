import { Router } from "express";
import {
  getDeliveries,
  createDelivery,
  updateDeliveryStatus,
  getRoutes,
  createRoute,
  createDeliverySchema,
  updateDeliveryStatusSchema,
} from "./deliveries.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/", authenticate, getDeliveries);
router.post("/", authenticate, validateBody(createDeliverySchema), createDelivery);
router.put("/:id/status", authenticate, validateBody(updateDeliveryStatusSchema), updateDeliveryStatus);

// Routes
router.get("/routes", authenticate, getRoutes);
router.post("/routes", authenticate, createRoute);

export const deliveryRoutes = router;
