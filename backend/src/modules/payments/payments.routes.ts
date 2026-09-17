import { Router } from "express";
import {
  getPayments,
  recordPayment,
  recordPaymentSchema,
} from "./payments.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/", authenticate, getPayments);
router.post("/", authenticate, validateBody(recordPaymentSchema), recordPayment);

export const paymentRoutes = router;
