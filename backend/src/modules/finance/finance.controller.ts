import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";
import {
  calculateExpectedClosingCash,
  calculateCashDifference,
  calculateOperatingCostPerBag,
  roundCurrency,
} from "../../utils/calculations.js";

export const createExpenseSchema = z.object({
  category: z.string(),
  description: z.string().min(3),
  payee: z.string().min(2),
  amount: z.number().positive("Expense amount must be positive"),
  paymentMethod: z.enum(["CASH", "BANK", "MOMO"]),
  accountId: z.string().uuid().optional(),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const cashReconciliationSchema = z.object({
  accountId: z.string().uuid().optional(),
  actualPhysicalCash: z.number().nonnegative("Counted cash cannot be negative"),
  explanationIfDiscrepancy: z.string().optional(),
});

export const ownerTransactionSchema = z.object({
  type: z.enum(["OWNER_CONTRIBUTION", "OWNER_WITHDRAWAL"]),
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "BANK", "MOMO"]),
  accountId: z.string().uuid().optional(),
  description: z.string().min(3),
  notes: z.string().optional(),
});

// -------------------------------------------------------------
// EXPENSE MANAGEMENT (Section 30)
// -------------------------------------------------------------

export async function getExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category, paymentMethod, startDate, endDate } = req.query;
    const where: Record<string, unknown> = {};

    if (category && typeof category === "string") where.category = category;
    if (paymentMethod && typeof paymentMethod === "string") where.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(String(startDate));
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(String(endDate));
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      success: true,
      data: {
        expenses,
        totalAmount: roundCurrency(totalAmount),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;
    const amount = roundCurrency(data.amount);

    const count = await prisma.expense.count();
    const expenseNumber = `NSP-EXP-${String(count + 1).padStart(4, "0")}`;

    // ATOMIC: Create expense and decrement Cash or Bank or MoMo
    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(),
          category: data.category,
          description: data.description,
          payee: data.payee,
          amount,
          paymentMethod: data.paymentMethod,
          accountType: data.paymentMethod,
          accountId: data.accountId || null,
          receiptNumber: data.receiptNumber || null,
          recordedBy: req.user?.username || null,
          notes: data.notes || null,
          isOwnerWithdrawal: false,
        },
      });

      if (data.paymentMethod === "CASH") {
        const cashAccount = data.accountId
          ? await tx.cashAccount.findUnique({ where: { id: data.accountId } })
          : await tx.cashAccount.findFirst({ where: { isActive: true } });

        if (cashAccount) {
          const newBal = roundCurrency(cashAccount.currentBalance - amount);
          await tx.cashAccount.update({
            where: { id: cashAccount.id },
            data: { currentBalance: newBal },
          });

          await tx.cashTransaction.create({
            data: {
              accountId: cashAccount.id,
              date: new Date(),
              type: "EXPENSE",
              amount: -amount,
              runningBalance: newBal,
              reference: expenseNumber,
              payeePayer: data.payee,
              recordedBy: req.user?.username || null,
              notes: `Expense: ${data.category} - ${data.description}`,
            },
          });
        }
      } else if (data.paymentMethod === "BANK" && data.accountId) {
        const bankAccount = await tx.bankAccount.findUnique({ where: { id: data.accountId } });
        if (bankAccount) {
          const newBal = roundCurrency(bankAccount.currentBalance - amount);
          await tx.bankAccount.update({
            where: { id: bankAccount.id },
            data: { currentBalance: newBal },
          });

          await tx.bankTransaction.create({
            data: {
              bankAccountId: bankAccount.id,
              date: new Date(),
              reference: data.receiptNumber || expenseNumber,
              description: `Expense: ${data.category} - ${data.payee}`,
              moneyIn: 0,
              moneyOut: amount,
              runningBalance: newBal,
              isReconciled: false,
            },
          });
        }
      }

      return expense;
    });

    await logAudit({
      action: "CREATE",
      module: "expenses",
      recordId: result.id,
      newValue: result,
      req,
    });

    res.status(201).json({
      success: true,
      data: { expense: result },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// CASHBOOK & PHYSICAL RECONCILIATION (Section 31)
// -------------------------------------------------------------

export async function getCashbook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cashAccount = await prisma.cashAccount.findFirst({ where: { isActive: true } });
    if (!cashAccount) {
      throw new AppError("No active cash account found", 404, "NOT_FOUND");
    }

    const transactions = await prisma.cashTransaction.findMany({
      where: { accountId: cashAccount.id },
      orderBy: { date: "desc" },
      take: 50,
    });

    // Summary of money in and money out
    let totalIn = 0;
    let totalOut = 0;
    for (const t of transactions) {
      if (t.amount > 0) totalIn += t.amount;
      else totalOut += Math.abs(t.amount);
    }

    res.json({
      success: true,
      data: {
        account: cashAccount,
        currentBalance: cashAccount.currentBalance,
        transactions,
        summary: {
          totalMoneyIn: roundCurrency(totalIn),
          totalMoneyOut: roundCurrency(totalOut),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function performCashCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { actualPhysicalCash, explanationIfDiscrepancy } = req.body;

    const cashAccount = await prisma.cashAccount.findFirst({ where: { isActive: true } });
    if (!cashAccount) {
      throw new AppError("No active cash account found", 404, "NOT_FOUND");
    }

    const expectedCash = cashAccount.currentBalance;
    const difference = calculateCashDifference(actualPhysicalCash, expectedCash);

    // If discrepancy exists, require explanation
    if (difference !== 0 && (!explanationIfDiscrepancy || explanationIfDiscrepancy.trim().length < 5)) {
      throw new AppError(
        `Cash difference of GH₵${difference.toFixed(2)} detected (Physical: GH₵${actualPhysicalCash.toFixed(2)}, ` +
          `Expected: GH₵${expectedCash.toFixed(2)}). A valid explanation is mandatory to reconcile.`,
        400,
        "DISCREPANCY_EXPLANATION_REQUIRED"
      );
    }

    // Record adjustment if needed
    if (difference !== 0) {
      await prisma.$transaction(async (tx) => {
        await tx.cashAccount.update({
          where: { id: cashAccount.id },
          data: { currentBalance: actualPhysicalCash },
        });

        await tx.cashTransaction.create({
          data: {
            accountId: cashAccount.id,
            date: new Date(),
            type: difference > 0 ? "OTHER_INCOME" : "EXPENSE",
            amount: difference,
            runningBalance: actualPhysicalCash,
            reference: "CASH-RECON",
            payeePayer: "Physical Cash Count Reconciliation",
            recordedBy: req.user?.username || null,
            notes: `Physical reconciliation difference: GH₵${difference.toFixed(2)}. Explanation: ${explanationIfDiscrepancy}`,
          },
        });
      });
    }

    await logAudit({
      action: "UPDATE",
      module: "cashbook",
      recordId: cashAccount.id,
      oldValue: { expectedCash },
      newValue: { actualPhysicalCash, difference, explanation: explanationIfDiscrepancy },
      req,
    });

    res.json({
      success: true,
      data: {
        expectedCash,
        actualPhysicalCash,
        difference,
        status: difference === 0 ? "BALANCED" : difference > 0 ? "SURPLUS" : "SHORTAGE",
      },
      message: difference === 0
        ? "Physical cash matches expected balance perfectly."
        : `Physical cash count recorded with ${difference > 0 ? "surplus" : "shortage"} of GH₵${Math.abs(difference).toFixed(2)}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// STRICT FINANCIAL CONTROL: OWNER CAPITAL VS DRAWINGS (Section 34)
// -------------------------------------------------------------

export async function recordOwnerTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;
    const amount = roundCurrency(data.amount);

    const isContribution = data.type === "OWNER_CONTRIBUTION";

    const result = await prisma.$transaction(async (tx) => {
      // 1. If Cash account
      if (data.paymentMethod === "CASH") {
        const cashAccount = data.accountId
          ? await tx.cashAccount.findUnique({ where: { id: data.accountId } })
          : await tx.cashAccount.findFirst({ where: { isActive: true } });

        if (cashAccount) {
          const delta = isContribution ? amount : -amount;
          const newBal = roundCurrency(cashAccount.currentBalance + delta);

          await tx.cashAccount.update({
            where: { id: cashAccount.id },
            data: { currentBalance: newBal },
          });

          await tx.cashTransaction.create({
            data: {
              accountId: cashAccount.id,
              date: new Date(),
              type: data.type,
              amount: delta,
              runningBalance: newBal,
              reference: isContribution ? "OWNER-CAPITAL" : "OWNER-DRAWING",
              payeePayer: "Owner / Proprietor",
              recordedBy: req.user?.username || null,
              notes: data.description,
            },
          });
        }
      }

      // 2. If Owner Withdrawal, also log as an Expense with isOwnerWithdrawal=true
      // This separates it from operating expenses in reports!
      if (!isContribution) {
        const count = await tx.expense.count();
        const expenseNumber = `NSP-EXP-DRW-${String(count + 1).padStart(4, "0")}`;

        await tx.expense.create({
          data: {
            expenseNumber,
            date: new Date(),
            category: "OWNER_DRAWINGS",
            description: `Owner personal drawing: ${data.description}`,
            payee: "Owner / Proprietor",
            amount,
            paymentMethod: data.paymentMethod,
            accountType: data.paymentMethod,
            accountId: data.accountId || null,
            recordedBy: req.user?.username || null,
            isOwnerWithdrawal: true,
          },
        });
      }

      return { type: data.type, amount };
    });

    await logAudit({
      action: "CREATE",
      module: "equity",
      newValue: result,
      req,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: isContribution
        ? `Owner capital contribution of GH₵${amount.toFixed(2)} recorded.`
        : `Owner withdrawal of GH₵${amount.toFixed(2)} recorded (isolated from operational expenses).`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// ESTIMATED OPERATING COST PER BAG (Section 36)
// -------------------------------------------------------------

export async function getCostPerBag(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(String(startDate));
    if (endDate) dateFilter.lte = new Date(String(endDate));

    // Exclude OWNER_DRAWINGS and LOAN_PAYMENTS from operating cost per bag
    const operatingExpenses = await prisma.expense.findMany({
      where: {
        isOwnerWithdrawal: false,
        category: { notIn: ["OWNER_DRAWINGS", "LOAN_PAYMENTS"] },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
    });

    const totalOperatingCost = operatingExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Sum of good bags sold in period
    const sales = await prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        ...(Object.keys(dateFilter).length > 0 ? { saleDate: dateFilter } : {}),
      },
      include: { items: true },
    });

    let totalBagsSold = 0;
    for (const s of sales) {
      totalBagsSold += s.items.reduce((sum, i) => sum + i.quantity, 0);
    }

    const costPerBag = calculateOperatingCostPerBag(totalOperatingCost, totalBagsSold);

    res.json({
      success: true,
      data: {
        totalOperatingCost: roundCurrency(totalOperatingCost),
        totalBagsSold,
        costPerBag,
        currency: "GHS",
        breakdownByCategory: operatingExpenses.reduce((acc: Record<string, number>, e) => {
          acc[e.category] = roundCurrency((acc[e.category] || 0) + e.amount);
          return acc;
        }, {}),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
