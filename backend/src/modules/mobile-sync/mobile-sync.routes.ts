import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { pullMobileEvents, pushMobileEvents } from "./mobile-sync.controller.js";

export const mobileSyncRoutes = Router();
mobileSyncRoutes.use(authenticate);
mobileSyncRoutes.post("/events", pushMobileEvents);
mobileSyncRoutes.get("/events", pullMobileEvents);
