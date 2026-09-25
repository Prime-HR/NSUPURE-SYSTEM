import { Router } from "express";
import {
  login,
  getMe,
  changePassword,
  updateProfile,
  getUsers,
  createUser,
  deleteUser,
  toggleUserStatus,
  adminResetUserPassword,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  createUserSchema,
  adminResetPasswordSchema,
} from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validation.js";

import { limitLogin } from "../../middleware/login-limit.js";

const router = Router();

router.post("/login", limitLogin, validateBody(loginSchema), login);
router.get("/me", authenticate, getMe);
router.put("/profile", authenticate, validateBody(updateProfileSchema), updateProfile);
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
router.put(
  "/users/:id/password",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  validateBody(adminResetPasswordSchema),
  adminResetUserPassword
);
router.delete(
  "/users/:id",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  deleteUser
);

export const authRoutes = router;
