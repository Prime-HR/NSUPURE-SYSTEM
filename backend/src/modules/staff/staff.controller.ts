import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";
import { roundCurrency } from "../../utils/calculations.js";

export const createEmployeeSchema = z.object({
  fullName: z.string().min(2),
  roleTitle: z.string().min(2),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  hireDate: z.string().optional(),
  basicMonthlySalary: z.number().positive().default(1000.0),
  paymentMethod: z.enum(["CASH", "MOMO", "BANK"]).default("CASH"),
  momoOrBankDetails: z.string().optional(),
  notes: z.string().optional(),
});

export const recordAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().optional(),
  status: z.enum(["PRESENT", "LATE", "HALF_DAY", "ABSENT", "EXCUSED"]).default("PRESENT"),
  notes: z.string().optional(),
});

export const generatePayrollSchema = z.object({
  payrollMonth: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-MM"),
  allowances: z.record(z.number()).optional(), // { employeeId: amount }
  deductions: z.record(z.number()).optional(), // { employeeId: amount }
});

// -------------------------------------------------------------
// EMPLOYEES DIRECTORY (Section 37)
// -------------------------------------------------------------

export async function getEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { fullName: "asc" },
      include: {
        _count: { select: { attendance: true, payrollRecords: true, deliveries: true } },
      },
    });

    res.json({
      success: true,
      data: { employees },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const count = await prisma.employee.count();
    const employeeCode = `NSP-EMP-${String(count + 1).padStart(3, "0")}`;

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        fullName: data.fullName,
        roleTitle: data.roleTitle,
        phone: data.phone || null,
        emergencyContact: data.emergencyContact || null,
        hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
        basicMonthlySalary: data.basicMonthlySalary,
        paymentMethod: data.paymentMethod,
        momoOrBankDetails: data.momoOrBankDetails || null,
        status: "ACTIVE",
        notes: data.notes || null,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "staff",
      recordId: employee.id,
      newValue: employee,
      req,
    });

    res.status(201).json({
      success: true,
      data: { employee },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Employee not found", 404, "NOT_FOUND");
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(data.fullName ? { fullName: data.fullName } : {}),
        ...(data.roleTitle ? { roleTitle: data.roleTitle } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.emergencyContact !== undefined ? { emergencyContact: data.emergencyContact } : {}),
        ...(data.basicMonthlySalary !== undefined ? { basicMonthlySalary: Number(data.basicMonthlySalary) } : {}),
        ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
        ...(data.momoOrBankDetails !== undefined ? { momoOrBankDetails: data.momoOrBankDetails } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });

    await logAudit({
      action: "UPDATE",
      module: "staff",
      recordId: id,
      oldValue: existing,
      newValue: updated,
      req,
    });

    res.json({
      success: true,
      data: { employee: updated },
      message: `Employee ${updated.fullName} updated successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        _count: {
          select: { attendance: true, payrollRecords: true, deliveries: true, trips: true },
        },
      },
    });

    if (!employee) {
      throw new AppError("Employee not found", 404, "NOT_FOUND");
    }

    const hasHistory =
      employee._count.attendance > 0 ||
      employee._count.payrollRecords > 0 ||
      employee._count.deliveries > 0 ||
      employee._count.trips > 0;

    if (hasHistory) {
      // Soft delete: deactivate/terminate to preserve historical payroll and audit records
      const terminated = await prisma.employee.update({
        where: { id },
        data: { status: "TERMINATED" },
      });

      await logAudit({
        action: "UPDATE",
        module: "staff",
        recordId: id,
        oldValue: { status: employee.status },
        newValue: { status: "TERMINATED" },
        req,
      });

      res.json({
        success: true,
        action: "DEACTIVATED",
        message: `Employee ${employee.fullName} has historical attendance/payroll/delivery records and was deactivated (TERMINATED) to preserve audit and accounting integrity.`,
        data: { employee: terminated },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Hard delete: safe to delete if created by mistake with zero historical activity
    await prisma.employee.delete({ where: { id } });

    await logAudit({
      action: "DELETE",
      module: "staff",
      recordId: id,
      oldValue: employee,
      req,
    });

    res.json({
      success: true,
      action: "DELETED",
      message: `Employee ${employee.fullName} was permanently deleted.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// DAILY ATTENDANCE (Section 37)
// -------------------------------------------------------------

export async function getAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { date, employeeId } = req.query;
    const where: Record<string, unknown> = {};

    if (employeeId && typeof employeeId === "string") where.employeeId = employeeId;
    if (date && typeof date === "string") {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      include: { employee: true },
    });

    res.json({
      success: true,
      data: { attendance },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const record = await prisma.attendance.create({
      data: {
        date: data.date ? new Date(data.date) : new Date(),
        employeeId: data.employeeId,
        timeIn: new Date(),
        status: data.status,
        notes: data.notes || null,
      },
      include: { employee: true },
    });

    res.status(201).json({
      success: true,
      data: { attendance: record },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// PAYROLL GENERATION & SETTLEMENT (Section 37)
// -------------------------------------------------------------

export async function getPayroll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { month } = req.query;
    const where: Record<string, unknown> = {};
    if (month && typeof month === "string") where.payrollMonth = month;

    const payroll = await prisma.payroll.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { employee: true },
    });

    res.json({
      success: true,
      data: { payroll },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function generateMonthlyPayroll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { payrollMonth, allowances = {}, deductions = {} } = req.body;

    const activeEmployees = await prisma.employee.findMany({
      where: { status: "ACTIVE" },
    });

    if (activeEmployees.length === 0) {
      throw new AppError("No active employees found to generate payroll", 400, "NO_EMPLOYEES");
    }

    const createdRecords = [];

    for (const emp of activeEmployees) {
      const allow = allowances[emp.id] || 0.0;
      const deduct = deductions[emp.id] || 0.0;
      const netPay = roundCurrency(emp.basicMonthlySalary + allow - deduct);

      const record = await prisma.payroll.create({
        data: {
          payrollMonth,
          employeeId: emp.id,
          basicSalary: emp.basicMonthlySalary,
          allowances: allow,
          deductions: deduct,
          netPay,
          paymentStatus: "UNPAID",
          paymentMethod: emp.paymentMethod,
          recordedBy: req.user?.username || null,
        },
        include: { employee: true },
      });
      createdRecords.push(record);
    }

    await logAudit({
      action: "CREATE",
      module: "payroll",
      newValue: { month: payrollMonth, count: createdRecords.length },
      req,
    });

    res.status(201).json({
      success: true,
      data: { payrollRecords: createdRecords },
      message: `Generated payroll for ${createdRecords.length} staff for ${payrollMonth}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function payPayrollRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { paymentMethod, reference } = req.body;

    const payroll = await prisma.payroll.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!payroll) {
      throw new AppError("Payroll record not found", 404, "NOT_FOUND");
    }

    if (payroll.paymentStatus === "PAID") {
      throw new AppError("Payroll is already marked as paid", 400, "ALREADY_PAID");
    }

    // ATOMIC: Mark payroll as PAID and create Expense record
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayroll = await tx.payroll.update({
        where: { id },
        data: {
          paymentStatus: "PAID",
          paymentDate: new Date(),
          paymentMethod: paymentMethod || payroll.paymentMethod,
          paymentReference: reference || null,
        },
      });

      const count = await tx.expense.count();
      const expenseNumber = `NSP-EXP-PAY-${String(count + 1).padStart(4, "0")}`;

      await tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(),
          category: "PAYROLL",
          description: `Staff salary for ${payroll.employee.fullName} (${payroll.payrollMonth})`,
          payee: payroll.employee.fullName,
          amount: payroll.netPay,
          paymentMethod: paymentMethod || payroll.paymentMethod,
          receiptNumber: reference || null,
          recordedBy: req.user?.username || null,
          isOwnerWithdrawal: false,
        },
      });

      return updatedPayroll;
    });

    await logAudit({
      action: "UPDATE",
      module: "payroll",
      recordId: id,
      newValue: { status: "PAID", amount: payroll.netPay },
      req,
    });

    res.json({
      success: true,
      data: { payroll: result },
      message: `Salary of GH₵${payroll.netPay.toFixed(2)} paid to ${payroll.employee.fullName}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
