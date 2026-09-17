import { Router } from "express";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getAttendance,
  recordAttendance,
  getPayroll,
  generateMonthlyPayroll,
  payPayrollRecord,
  createEmployeeSchema,
  recordAttendanceSchema,
  generatePayrollSchema,
} from "./staff.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRoles } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

// Staff Directory
router.get("/employees", authenticate, getEmployees);
router.post(
  "/employees",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR", "MANAGER"),
  validateBody(createEmployeeSchema),
  createEmployee
);
router.put(
  "/employees/:id",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR", "MANAGER"),
  updateEmployee
);
router.delete(
  "/employees/:id",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR"),
  deleteEmployee
);

// Attendance
router.get("/attendance", authenticate, getAttendance);
router.post("/attendance", authenticate, validateBody(recordAttendanceSchema), recordAttendance);

// Payroll
router.get("/payroll", authenticate, getPayroll);
router.post(
  "/payroll/generate",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR", "FINANCE"),
  validateBody(generatePayrollSchema),
  generateMonthlyPayroll
);
router.post(
  "/payroll/:id/pay",
  authenticate,
  requireRoles("OWNER", "ADMINISTRATOR", "FINANCE"),
  payPayrollRecord
);

export const staffRoutes = router;
