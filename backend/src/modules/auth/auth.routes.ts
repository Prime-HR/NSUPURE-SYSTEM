import { Router } from "express";
import {
  login,
  getMe,
  changePassword,
  getUsers,
  createUser,
  deleteUser,
  toggleUserStatus,
  loginSchema,
  changePasswordSchema,
  createUserSchema,
} from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.post("/login", validateBody(loginSchema), login);
router.get("/me", authenticate, getMe);
router.post("/change-password", authenticate, validateBody(changePasswordSchema), changePassword);

// System user management (Owner / Administrator only)
router.get("/users", authenticate, requireRoles("OWNER", "ADMINISTRATOR"), getUsers);
router.post(
  "/users",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  validateBody(createUserSchema),
  createUser
);
router.put(
  "/users/:id/status",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  toggleUserStatus
);
router.delete(
  "/users/:id",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  deleteUser
);

export const authRoutes = router;
