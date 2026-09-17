import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";
import { calculateRevenue, calculateCreditCreated, roundCurrency } from "../../utils/calculations.js";

export const createSaleSchema = z.object({
  customerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive("Quantity must be greater than zero"),
      unitPrice: z.number().positive("Unit price must be positive"),
    })
  ).min(1, "Sale must include at least one product item"),
  amountReceived: z.number().nonnegative("Amount received cannot be negative").default(0.0),
  paymentMethod: z.enum(["CASH", "MOMO", "BANK", "CREDIT", "SPLIT"]).default("CASH"),
  accountId: z.string().uuid().optional(), // target cash/bank/momo account
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export const voidSaleSchema = z.object({
  reason: z.string().min(5, "A clear reason for voiding this sale is required"),
});

export async function getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate, customerId, status } = req.query;
    const where: Record<string, unknown> = {};

    if (customerId && typeof customerId === "string") where.customerId = customerId;
    if (status && typeof status === "string") where.status = status;

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) (where.saleDate as Record<string, unknown>).gte = new Date(String(startDate));
      if (endDate) (where.saleDate as Record<string, unknown>).lte = new Date(String(endDate));
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { saleDate: "desc" },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
        salesperson: { select: { id: true, username: true, fullName: true } },
      },
    });

    res.json({
      success: true,
      data: { sales },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getSaleById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
        order: true,
        salesperson: { select: { id: true, username: true, fullName: true } },
      },
    });

    if (!sale) {
      throw new AppError("Sale not found", 404, "NOT_FOUND");
    }

    res.json({
      success: true,
      data: { sale },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createSale(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    // Check Customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
    }

    // Calculate total amount across all items
    let totalAmount = 0;
    for (const item of data.items) {
      totalAmount += calculateRevenue(item.quantity, item.unitPrice);
    }
    totalAmount = roundCurrency(totalAmount);

    const amountReceived = roundCurrency(data.amountReceived);
    if (amountReceived > totalAmount) {
      // Amount received exceeds total -> permitted as advance or change, but credit cannot be negative
    }
    const creditAmount = calculateCreditCreated(totalAmount, amountReceived);

    // Credit Limit Verification: if customer creates credit, ensure it does not exceed credit limit
    if (creditAmount > 0 && customer.creditLimit > 0) {
      const projectedBalance = roundCurrency(customer.currentBalance + creditAmount);
      if (projectedBalance > customer.creditLimit) {
        throw new AppError(
          `Credit limit exceeded. Current balance: GH₵${customer.currentBalance.toFixed(2)}, ` +
            `New credit: GH₵${creditAmount.toFixed(2)}, Limit: GH₵${customer.creditLimit.toFixed(2)}`,
          400,
          "CREDIT_LIMIT_EXCEEDED"
        );
      }
    }

    // ATOMIC DATABASE TRANSACTION (Section 70)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate Sale Number e.g. NSP-SAL-0001
      const count = await tx.sale.count();
      const saleNumber = `NSP-SAL-${String(count + 1).padStart(4, "0")}`;

      // 2. Create Sale Record
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          customerId: data.customerId,
          orderId: data.orderId || null,
          totalAmount,
          amountReceived,
          creditAmount,
          paymentMethod: data.paymentMethod,
          dueDate: creditAmount > 0 ? (data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 3 * 86400000)) : null,
          salespersonId: req.user?.id || null,
          status: "COMPLETED",
          notes: data.notes || null,
          items: {
            create: data.items.map((i: { productId: string; quantity: number; unitPrice: number }) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: roundCurrency(i.quantity * i.unitPrice),
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // 3. Update Customer Current Balance
      if (creditAmount > 0) {
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            currentBalance: roundCurrency(customer.currentBalance + creditAmount),
          },
        });
      }

      // 4. Record Payment if amountReceived > 0
      if (amountReceived > 0) {
        const paymentCount = await tx.payment.count();
        const paymentNumber = `NSP-PAY-${String(paymentCount + 1).padStart(4, "0")}`;

        await tx.payment.create({
          data: {
            paymentNumber,
            customerId: data.customerId,
            saleId: sale.id,
            paymentDate: new Date(),
            amount: amountReceived,
            paymentMethod: data.paymentMethod === "CREDIT" ? "CASH" : data.paymentMethod,
            paymentType: creditAmount > 0 ? "PARTIAL" : "FULL",
            accountId: data.accountId || null,
            recordedById: req.user?.id || null,
            notes: `Auto-recorded on sale creation ${saleNumber}`,
          },
        });

        // 5. Update Cash Account if paid by CASH
        if (data.paymentMethod === "CASH" || data.paymentMethod === "SPLIT") {
          const cashAccount = data.accountId
            ? await tx.cashAccount.findUnique({ where: { id: data.accountId } })
            : await tx.cashAccount.findFirst({ where: { isActive: true } });

          if (cashAccount) {
            const newBal = roundCurrency(cashAccount.currentBalance + amountReceived);
            await tx.cashAccount.update({
              where: { id: cashAccount.id },
              data: { currentBalance: newBal },
            });

            await tx.cashTransaction.create({
              data: {
                accountId: cashAccount.id,
                date: new Date(),
                type: "CASH_SALE",
                amount: amountReceived,
                runningBalance: newBal,
                reference: saleNumber,
                payeePayer: customer.businessName,
                recordedBy: req.user?.username || null,
                notes: `Cash sale collection ${saleNumber}`,
              },
            });
          }
        }
      }

      // 6. Update order status if orderId provided
      if (data.orderId) {
        await tx.order.update({
          where: { id: data.orderId },
          data: {
            status: "DELIVERED",
            paymentStatus: creditAmount > 0 ? "PARTIAL" : "PAID",
            amountPaid: amountReceived,
            balanceDue: creditAmount,
          },
        });
      }

      return sale;
    });

    await logAudit({
      action: "CREATE",
      module: "sales",
      recordId: result.id,
      newValue: {
        saleNumber: result.saleNumber,
        totalAmount,
        amountReceived,
        creditAmount,
      },
      req,
    });

    res.status(201).json({
      success: true,
      data: { sale: result },
      message: `Sale ${result.saleNumber} recorded successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Void/Reverse a Sale transaction with mandatory audit trail
 */
export async function voidSale(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { customer: true, payments: true },
    });

    if (!sale) {
      throw new AppError("Sale not found", 404, "NOT_FOUND");
    }

    if (sale.status === "VOIDED") {
      throw new AppError("Sale is already voided", 400, "ALREADY_VOIDED");
    }

    // Atomic reversal
    await prisma.$transaction(async (tx) => {
      // 1. Mark sale as VOIDED
      await tx.sale.update({
        where: { id },
        data: {
          status: "VOIDED",
          voidReason: reason,
          voidedBy: req.user?.username || "UNKNOWN",
        },
      });

      // 2. Reverse customer credit balance if credit was created
      if (sale.creditAmount > 0) {
        const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
        if (customer) {
          const newBal = roundCurrency(customer.currentBalance - sale.creditAmount);
          await tx.customer.update({
            where: { id: sale.customerId },
            data: { currentBalance: newBal < 0 ? 0 : newBal },
          });
        }
      }
    });

    await logAudit({
      action: "VOID",
      module: "sales",
      recordId: id,
      oldValue: { status: sale.status },
      newValue: { status: "VOIDED", reason },
      req,
    });

    res.json({
      success: true,
      message: `Sale ${sale.saleNumber} voided and balances reversed successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
