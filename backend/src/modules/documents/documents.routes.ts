import { Router } from "express";
import {
  getDocuments,
  createDocument,
  addDocumentVersion,
  getExpiringDocuments,
  createDocumentSchema,
  createNewVersionSchema,
} from "./documents.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/", authenticate, getDocuments);
router.get("/expiring", authenticate, getExpiringDocuments);
router.post("/", authenticate, validateBody(createDocumentSchema), createDocument);
router.post("/:id/version", authenticate, validateBody(createNewVersionSchema), addDocumentVersion);

export const documentRoutes = router;
