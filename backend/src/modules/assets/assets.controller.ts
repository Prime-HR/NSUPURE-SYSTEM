import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";
import { roundCurrency } from "../../utils/calculations.js";

export const createAssetSchema = z.object({
  name: z.string().min(2),
  category: z.enum([
    "LAND",
    "FACTORY_BUILDING",
    "TREATMENT_PLANT",
    "FILTRATION_EQUIPMENT",
    "SACHET_MACHINE",
    "STORAGE_TANKS",
    "GENERATOR",
    "VEHICLE",
    "OFFICE_EQUIPMENT",
    "OTHER_MACHINERY",
  ]),
  acquisitionDate: z.string().optional(),
  originalCost: z.number().nonnegative().optional(),
  currentEstimatedValue: z.number().nonnegative().optional(),
  isProfessionallyAppraised: z.boolean().default(false),
  appraisalDocumentUrl: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().default("Adumasa Factory"),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "OUT_OF_SERVICE"]).default("GOOD"),
  notes: z.string().optional(),
});

export const recordAssetMaintenanceSchema = z.object({
  assetId: z.string().uuid(),
  date: z.string().optional(),
  problem: z.string().min(3),
  workPerformed: z.string().min(3),
  technician: z.string().optional(),
  partsReplaced: z.string().optional(),
  cost: z.number().nonnegative().default(0.0),
  downtimeHours: z.number().nonnegative().default(0.0),
  nextServiceDate: z.string().optional(),
  notes: z.string().optional(),
});

export const createLoanSchema = z.object({
  lenderName: z.string().min(2),
  purpose: z.string().optional(),
  originalPrincipal: z.number().positive("Principal must be positive"),
  interestRatePct: z.number().nonnegative().default(0.0),
  startDate: z.string().optional(),
  maturityDate: z.string().optional(),
  installmentAmount: z.number().positive().optional(),
  nextPaymentDate: z.string().optional(),
  collateralDetails: z.string().optional(),
  isManagementConfirmed: z.boolean().default(false),
  notes: z.string().optional(),
});

export const recordLoanPaymentSchema = z.object({
  loanId: z.string().uuid(),
  principalPaid: z.number().positive(),
  interestPaid: z.number().nonnegative().default(0.0),
  paymentMethod: z.enum(["CASH", "BANK", "MOMO"]).default("BANK"),
  accountId: z.string().uuid().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

// -------------------------------------------------------------
// ASSETS & MAINTENANCE (Section 41)
// -------------------------------------------------------------

export async function getAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const assets = await prisma.asset.findMany({
      orderBy: { name: "asc" },
      include: {
        maintenanceRecords: {
          orderBy: { date: "desc" },
          take: 3,
        },
      },
    });

    const totalEstimatedValue = assets.reduce(
      (sum, a) => sum + (a.currentEstimatedValue || a.originalCost || 0),
      0
    );

    res.json({
      success: true,
      data: {
        assets,
        totalEstimatedValue: roundCurrency(totalEstimatedValue),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const count = await prisma.asset.count();
    const assetCode = `NSP-AST-${String(count + 1).padStart(3, "0")}`;

    const asset = await prisma.asset.create({
      data: {
        assetCode,
        name: data.name,
        category: data.category,
        acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null,
        originalCost: data.originalCost || null,
        currentEstimatedValue: data.currentEstimatedValue || null,
        isProfessionallyAppraised: Boolean(data.isProfessionallyAppraised && data.appraisalDocumentUrl),
        appraisalDocumentUrl: data.appraisalDocumentUrl || null,
        serialNumber: data.serialNumber || null,
        location: data.location || "Adumasa Factory",
        condition: data.condition,
        notes: data.notes || null,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "assets",
      recordId: asset.id,
      newValue: asset,
      req,
    });

    res.status(201).json({
      success: true,
      data: { asset },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordAssetMaintenance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const maintenance = await prisma.assetMaintenance.create({
      data: {
        assetId: data.assetId,
        date: data.date ? new Date(data.date) : new Date(),
        problem: data.problem,
        workPerformed: data.workPerformed,
        technician: data.technician || null,
        partsReplaced: data.partsReplaced || null,
        cost: data.cost,
        downtimeHours: data.downtimeHours,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : null,
        notes: data.notes || null,
      },
      include: { asset: true },
    });

    // Automatically record an Expense if cost > 0
    if (data.cost > 0) {
      const count = await prisma.expense.count();
      const expenseNumber = `NSP-EXP-MNT-${String(count + 1).padStart(4, "0")}`;

      await prisma.expense.create({
        data: {
          expenseNumber,
          date: new Date(),
          category: "MAINTENANCE",
          description: `Asset Maintenance: ${maintenance.asset.name} - ${data.workPerformed}`,
          payee: data.technician || "Maintenance Technician",
          amount: data.cost,
          paymentMethod: "CASH",
          recordedBy: req.user?.username || null,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: { maintenance },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// LOANS & DEBTS (Section 42)
// -------------------------------------------------------------

export async function getLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const loans = await prisma.loan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        payments: {
          orderBy: { paymentDate: "desc" },
        },
      },
    });

    const totalOutstandingDebt = loans
      .filter((l) => l.status === "ACTIVE" && l.isManagementConfirmed)
      .reduce((sum, l) => sum + l.currentBalance, 0);

    res.json({
      success: true,
      data: {
        loans,
        totalOutstandingDebt: roundCurrency(totalOutstandingDebt),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const count = await prisma.loan.count();
    const loanCode = `NSP-LOAN-${String(count + 1).padStart(3, "0")}`;

    const loan = await prisma.loan.create({
      data: {
        loanCode,
        lenderName: data.lenderName,
        purpose: data.purpose || null,
        originalPrincipal: data.originalPrincipal,
        currentBalance: data.originalPrincipal,
        interestRatePct: data.interestRatePct,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        maturityDate: data.maturityDate ? new Date(data.maturityDate) : null,
        installmentAmount: data.installmentAmount || null,
        nextPaymentDate: data.nextPaymentDate ? new Date(data.nextPaymentDate) : null,
        collateralDetails: data.collateralDetails || null,
        status: "ACTIVE",
        isManagementConfirmed: data.isManagementConfirmed,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "loans",
      recordId: loan.id,
      newValue: loan,
      req,
    });

    res.status(201).json({
      success: true,
      data: { loan },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordLoanPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;
    const totalPaid = roundCurrency(data.principalPaid + data.interestPaid);

    const loan = await prisma.loan.findUnique({ where: { id: data.loanId } });
    if (!loan) {
      throw new AppError("Loan record not found", 404, "NOT_FOUND");
    }

    const newBalance = roundCurrency(loan.currentBalance - data.principalPaid);

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.loanPayment.create({
        data: {
          loanId: data.loanId,
          paymentDate: new Date(),
          principalPaid: data.principalPaid,
          interestPaid: data.interestPaid,
          totalPaid,
          paymentMethod: data.paymentMethod,
          accountId: data.accountId || null,
          referenceNumber: data.referenceNumber || null,
          remainingBalance: newBalance < 0 ? 0 : newBalance,
          recordedBy: req.user?.username || null,
        },
      });

      await tx.loan.update({
        where: { id: data.loanId },
        data: {
          currentBalance: newBalance < 0 ? 0 : newBalance,
          status: newBalance <= 0 ? "FULLY_PAID" : "ACTIVE",
        },
      });

      // Record in expenses as loan repayment
      const count = await tx.expense.count();
      const expenseNumber = `NSP-EXP-LON-${String(count + 1).padStart(4, "0")}`;

      await tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(),
          category: "LOAN_PAYMENTS",
          description: `Loan repayment to ${loan.lenderName} (Principal: GH₵${data.principalPaid}, Interest: GH₵${data.interestPaid})`,
          payee: loan.lenderName,
          amount: totalPaid,
          paymentMethod: data.paymentMethod,
          receiptNumber: data.referenceNumber || null,
          recordedBy: req.user?.username || null,
          isOwnerWithdrawal: false,
        },
      });

      return payment;
    });

    await logAudit({
      action: "UPDATE",
      module: "loans",
      recordId: loan.id,
      oldValue: { balance: loan.currentBalance },
      newValue: { balance: newBalance, paid: totalPaid },
      req,
    });

    res.status(201).json({
      success: true,
      data: { loanPayment: result },
      message: `Loan payment of GH₵${totalPaid.toFixed(2)} recorded. New balance: GH₵${newBalance.toFixed(2)}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
