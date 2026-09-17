import { Router } from "express";
import {
  getQualityTests,
  recordQualityTest,
  getCleaningRecords,
  recordCleaning,
  getComplaints,
  createComplaint,
  resolveComplaint,
  recordQualityTestSchema,
  recordCleaningSchema,
  createComplaintSchema,
  resolveComplaintSchema,
} from "./quality.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

// Quality tests
router.get("/tests", authenticate, getQualityTests);
router.post("/tests", authenticate, validateBody(recordQualityTestSchema), recordQualityTest);

// Sanitation checklist (accessible via /cleaning or /sanitation)
router.get("/cleaning", authenticate, getCleaningRecords);
router.post("/cleaning", authenticate, validateBody(recordCleaningSchema), recordCleaning);
router.get("/sanitation", authenticate, getCleaningRecords);
router.post("/sanitation", authenticate, validateBody(recordCleaningSchema), recordCleaning);

// Complaints
router.get("/complaints", authenticate, getComplaints);
router.post("/complaints", authenticate, validateBody(createComplaintSchema), createComplaint);
router.put("/complaints/:id/resolve", authenticate, validateBody(resolveComplaintSchema), resolveComplaint);

export const qualityRoutes = router;
