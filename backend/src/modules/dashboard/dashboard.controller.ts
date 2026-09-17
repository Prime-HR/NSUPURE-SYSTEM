import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma.js";
import { roundCurrency, calculateRejectRate } from "../../utils/calculations.js";

export async function getDashboardOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // TODAY METRICS (Section 14)
    const [
      todayRuns,
      todaySales,
      todayPayments,
      todayExpenses,
      todayDeliveries,
      cashAccount,
      allCustomers,
      inventoryItems,
    ] = await Promise.all([
      prisma.productionRun.findMany({
        where: { date: { gte: today, lte: endOfToday } },
      }),
      prisma.sale.findMany({
        where: { saleDate: { gte: today, lte: endOfToday }, status: "COMPLETED" },
        include: { items: true },
      }),
      prisma.payment.findMany({
        where: { paymentDate: { gte: today, lte: endOfToday } },
      }),
      prisma.expense.findMany({
        where: { date: { gte: today, lte: endOfToday }, isOwnerWithdrawal: false },
      }),
      prisma.delivery.findMany({
        where: { deliveryDate: { gte: today, lte: endOfToday } },
      }),
      prisma.cashAccount.findFirst({ where: { isActive: true } }),
      prisma.customer.findMany({ select: { currentBalance: true } }),
      prisma.inventoryItem.findMany(),
    ]);

    const todayGoodBags = todayRuns.reduce((sum, r) => sum + r.goodBags, 0);
    const todayProducedBags = todayRuns.reduce((sum, r) => sum + r.bagsProduced, 0);
    const todayRejects = todayRuns.reduce((sum, r) => sum + r.rejectedBags, 0);
    const todayRejectRate = calculateRejectRate(todayProducedBags, todayRejects);

    let todayBagsSold = 0;
    let todayRevenue = 0;
    let todayCreditSales = 0;
    for (const s of todaySales) {
      todayRevenue += s.totalAmount;
      todayCreditSales += s.creditAmount;
      todayBagsSold += s.items.reduce((sum, i) => sum + i.quantity, 0);
    }

    const todayCashReceived = todayPayments
      .filter((p) => p.paymentMethod === "CASH")
      .reduce((sum, p) => sum + p.amount, 0);

    const todayExpensesAmount = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const todayDeliveriesCount = todayDeliveries.filter((d) => d.status === "DELIVERED").length;
    const totalOutstandingCredit = allCustomers.reduce((sum, c) => sum + c.currentBalance, 0);

    // MONTH METRICS (Section 14)
    const [monthRuns, monthSales, monthExpenses] = await Promise.all([
      prisma.productionRun.findMany({
        where: { date: { gte: firstDayOfMonth, lte: endOfToday } },
      }),
      prisma.sale.findMany({
        where: { saleDate: { gte: firstDayOfMonth, lte: endOfToday }, status: "COMPLETED" },
        include: { items: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: firstDayOfMonth, lte: endOfToday }, isOwnerWithdrawal: false },
      }),
    ]);

    const monthGoodBags = monthRuns.reduce((sum, r) => sum + r.goodBags, 0);
    const monthProducedBags = monthRuns.reduce((sum, r) => sum + r.bagsProduced, 0);
    const monthRejects = monthRuns.reduce((sum, r) => sum + r.rejectedBags, 0);
    const monthRejectRate = calculateRejectRate(monthProducedBags, monthRejects);

    let monthRevenue = 0;
    let monthBagsSold = 0;
    for (const s of monthSales) {
      monthRevenue += s.totalAmount;
      monthBagsSold += s.items.reduce((sum, i) => sum + i.quantity, 0);
    }

    const monthExpensesAmount = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const monthOperatingSurplus = roundCurrency(monthRevenue - monthExpensesAmount);

    // REAL DATA-DRIVEN ALERTS (Section 15)
    const alerts: Array<{ type: string; title: string; message: string; severity: string; link?: string }> = [];

    // Alert 1: Overdue customer credit
    const overdueCustomers = await prisma.customer.findMany({
      where: {
        currentBalance: { gt: 0 },
        sales: {
          some: {
            dueDate: { lt: new Date() },
            creditAmount: { gt: 0 },
            status: "COMPLETED",
          },
        },
      },
      take: 5,
    });
    if (overdueCustomers.length > 0) {
      alerts.push({
        type: "OVERDUE_CREDIT",
        title: "Overdue Customer Credit",
        message: `${overdueCustomers.length} customer(s) have payments overdue past credit terms.`,
        severity: "WARNING",
        link: "/customers",
      });
    }

    // Alert 2: Low inventory below reorder level
    const lowStockItems = inventoryItems.filter((i) => i.currentStock <= i.reorderLevel);
    if (lowStockItems.length > 0) {
      alerts.push({
        type: "LOW_INVENTORY",
        title: "Low Inventory Stock",
        message: `${lowStockItems.length} item(s) are below safety reorder level (${lowStockItems.map((i) => i.name).join(", ")}).`,
        severity: "WARNING",
        link: "/inventory",
      });
    }

    // Alert 3: Expiring compliance documents
    const thirtyDaysAhead = new Date(Date.now() + 30 * 86400000);
    const expiringDocs = await prisma.document.findMany({
      where: {
        expiryDate: { gte: new Date(), lte: thirtyDaysAhead },
        status: "ACTIVE",
      },
    });
    if (expiringDocs.length > 0) {
      alerts.push({
        type: "DOCUMENT_EXPIRING",
        title: "Compliance Document Expiring Soon",
        message: `${expiringDocs.length} regulatory or business document(s) expire within 30 days.`,
        severity: "HIGH",
        link: "/documents",
      });
    }

    // Alert 4: High production reject rate (> 3%)
    if (todayRejectRate > 3.0) {
      alerts.push({
        type: "HIGH_REJECT_RATE",
        title: "Production Reject Rate Alert",
        message: `Today's reject rate is ${todayRejectRate}%, exceeding the 3% target threshold. Inspect filling sealers.`,
        severity: "HIGH",
        link: "/production",
      });
    }

    res.json({
      success: true,
      data: {
        today: {
          productionBags: todayGoodBags,
          producedTotal: todayProducedBags,
          rejectedBags: todayRejects,
          rejectRate: todayRejectRate,
          salesBags: todayBagsSold,
          revenue: roundCurrency(todayRevenue),
          cashReceived: roundCurrency(todayCashReceived),
          creditSales: roundCurrency(todayCreditSales),
          expenses: roundCurrency(todayExpensesAmount),
          deliveriesCompleted: todayDeliveriesCount,
        },
        month: {
          productionBags: monthGoodBags,
          salesBags: monthBagsSold,
          revenue: roundCurrency(monthRevenue),
          expenses: roundCurrency(monthExpensesAmount),
          estimatedOperatingSurplus: monthOperatingSurplus,
          rejectRate: monthRejectRate,
          averageSellingPrice: monthBagsSold > 0 ? roundCurrency(monthRevenue / monthBagsSold) : 7.0,
        },
        overall: {
          cashInTill: cashAccount?.currentBalance || 0.0,
          outstandingReceivables: roundCurrency(totalOutstandingCredit),
          activeCustomers: allCustomers.length,
        },
        alerts,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
