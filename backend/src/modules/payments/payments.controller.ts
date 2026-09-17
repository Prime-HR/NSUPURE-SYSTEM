import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";
import { roundCurrency } from "../../utils/calculations.js";

export const recordPaymentSchema = z.object({
  customerId: z.string().uuid(),
  saleId: z.string().uuid().optional(),
  amount: z.number().positive("Payment amount must be greater than zero"),
  paymentMethod: z.enum(["CASH", "MOMO", "BANK", "OTHER"]),
  paymentType: z.enum(["FULL", "PARTIAL", "ADVANCE", "CREDIT_SETTLEMENT", "REFUND"]).default("CREDIT_SETTLEMENT"),
  referenceNumber: z.string().optional(),
  accountId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId, saleId, paymentMethod } = req.query;
    const where: Record<string, unknown> = {};

    if (customerId && typeof customerId === "string") where.customerId = customerId;
    if (saleId && typeof saleId === "string") where.saleId = saleId;
    if (paymentMethod && typeof paymentMethod === "string") where.paymentMethod = paymentMethod;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paymentDate: "desc" },
      include: {
        customer: true,
        sale: true,
        recordedBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    res.json({
      success: true,
      data: { payments },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;
    const amount = roundCurrency(data.amount);

    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      throw new AppError("Customer not found", 404, "NOT_FOUND");
    }

    // Atomic payment and account balance update
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.payment.count();
      const paymentNumber = `NSP-PAY-${String(count + 1).padStart(4, "0")}`;

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          customerId: data.customerId,
          saleId: data.saleId || null,
          paymentDate: new Date(),
          amount,
          paymentMethod: data.paymentMethod,
          paymentType: data.paymentType,
          referenceNumber: data.referenceNumber || null,
          accountId: data.accountId || null,
          recordedById: req.user?.id || null,
          notes: data.notes || null,
        },
      });

      // Update customer balance:
      // If CREDIT_SETTLEMENT or FULL or PARTIAL: reduce customer debt
      // If REFUND: increase customer debt (or refund cash)
      if (data.paymentType === "REFUND") {
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            currentBalance: roundCurrency(customer.currentBalance + amount),
          },
        });
      } else {
        const newCustomerBal = roundCurrency(customer.currentBalance - amount);
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            currentBalance: newCustomerBal,
          },
        });
      }

      // Update financial account (Cash/Bank/MoMo)
      if (data.paymentMethod === "CASH") {
        const cashAccount = data.accountId
          ? await tx.cashAccount.findUnique({ where: { id: data.accountId } })
          : await tx.cashAccount.findFirst({ where: { isActive: true } });

        if (cashAccount) {
          const delta = data.paymentType === "REFUND" ? -amount : amount;
          const newBal = roundCurrency(cashAccount.currentBalance + delta);

          await tx.cashAccount.update({
            where: { id: cashAccount.id },
            data: { currentBalance: newBal },
          });

          await tx.cashTransaction.create({
            data: {
              accountId: cashAccount.id,
              date: new Date(),
              type: data.paymentType === "REFUND" ? "EXPENSE" : "CREDIT_COLLECTION",
              amount: delta,
              runningBalance: newBal,
              reference: paymentNumber,
              payeePayer: customer.businessName,
              recordedBy: req.user?.username || null,
              notes: `Payment receipt ${paymentNumber} (${data.paymentType})`,
            },
          });
        }
      } else if (data.paymentMethod === "BANK" && data.accountId) {
        const bankAccount = await tx.bankAccount.findUnique({ where: { id: data.accountId } });
        if (bankAccount) {
          const delta = data.paymentType === "REFUND" ? -amount : amount;
          const newBal = roundCurrency(bankAccount.currentBalance + delta);

          await tx.bankAccount.update({
            where: { id: bankAccount.id },
            data: { currentBalance: newBal },
          });

          await tx.bankTransaction.create({
            data: {
              bankAccountId: bankAccount.id,
              date: new Date(),
              reference: data.referenceNumber || paymentNumber,
              description: `Customer payment: ${customer.businessName}`,
              moneyIn: delta > 0 ? delta : 0,
              moneyOut: delta < 0 ? Math.abs(delta) : 0,
              runningBalance: newBal,
              isReconciled: false,
            },
          });
        }
      }

      return payment;
    });

    await logAudit({
      action: "CREATE",
      module: "payments",
      recordId: result.id,
      newValue: {
        paymentNumber: result.paymentNumber,
        amount,
        customer: customer.businessName,
      },
      req,
    });

    res.status(201).json({
      success: true,
      data: { payment: result },
      message: `Payment of GH₵${amount.toFixed(2)} recorded successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
