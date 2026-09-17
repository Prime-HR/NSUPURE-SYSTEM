import { Router } from "express";
import { globalSearch } from "./search.controller.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

router.get("/", authenticate, globalSearch);

export const searchRoutes = router;
