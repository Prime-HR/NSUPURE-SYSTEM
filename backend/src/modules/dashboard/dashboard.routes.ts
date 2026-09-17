import { Router } from "express";
import { getDashboardOverview } from "./dashboard.controller.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

router.get("/overview", authenticate, getDashboardOverview);
router.get("/summary", authenticate, getDashboardOverview);

export const dashboardRoutes = router;
