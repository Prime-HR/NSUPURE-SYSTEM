import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma.js";
import { BUSINESS_INFO } from "../../config/constants.js";
import {
  roundCurrency,
  calculateRejectRate,
  calculateOperatingCostPerBag,
} from "../../utils/calculations.js";

// -------------------------------------------------------------
// MONTHLY MANAGEMENT REPORT (Section 55)
// -------------------------------------------------------------

export async function getMonthlyManagementReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { year, month } = req.query;
    const reportYear = year ? parseInt(String(year), 10) : new Date().getFullYear();
    const reportMonth = month ? parseInt(String(month), 10) - 1 : new Date().getMonth();

    const startOfMonth = new Date(reportYear, reportMonth, 1);
    const endOfMonth = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59, 999);

    // Previous month range for comparative analysis
    const prevStartOfMonth = new Date(reportYear, reportMonth - 1, 1);
    const prevEndOfMonth = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);

    const [
      currRuns,
      prevRuns,
      currSales,
      prevSales,
      currExpenses,
      prevExpenses,
      currDeliveries,
      allCustomers,
      vehicles,
      assets,
      activeLoans,
      complaints,
      qualityTests,
    ] = await Promise.all([
      prisma.productionRun.findMany({ where: { date: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.productionRun.findMany({ where: { date: { gte: prevStartOfMonth, lte: prevEndOfMonth } } }),
      prisma.sale.findMany({
        where: { saleDate: { gte: startOfMonth, lte: endOfMonth }, status: "COMPLETED" },
        include: { items: true },
      }),
      prisma.sale.findMany({
        where: { saleDate: { gte: prevStartOfMonth, lte: prevEndOfMonth }, status: "COMPLETED" },
        include: { items: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: startOfMonth, lte: endOfMonth }, isOwnerWithdrawal: false },
      }),
      prisma.expense.findMany({
        where: { date: { gte: prevStartOfMonth, lte: prevEndOfMonth }, isOwnerWithdrawal: false },
      }),
      prisma.delivery.findMany({ where: { deliveryDate: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.customer.findMany({ select: { id: true, currentBalance: true } }),
      prisma.vehicle.findMany(),
      prisma.asset.findMany(),
      prisma.loan.findMany({ where: { status: "ACTIVE", isManagementConfirmed: true } }),
      prisma.complaint.findMany({ where: { dateReceived: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.qualityTest.findMany({ where: { testDate: { gte: startOfMonth, lte: endOfMonth } } }),
    ]);

    // Current Month Aggregates
    const currentGoodBags = currRuns.reduce((sum, r) => sum + r.goodBags, 0);
    const currentProducedBags = currRuns.reduce((sum, r) => sum + r.bagsProduced, 0);
    const currentRejects = currRuns.reduce((sum, r) => sum + r.rejectedBags, 0);
    const currentRejectRate = calculateRejectRate(currentProducedBags, currentRejects);

    let currentRevenue = 0;
    let currentBagsSold = 0;
    let currentCreditSales = 0;
    for (const s of currSales) {
      currentRevenue += s.totalAmount;
      currentCreditSales += s.creditAmount;
      currentBagsSold += s.items.reduce((sum, i) => sum + i.quantity, 0);
    }

    const currentExpenses = currExpenses.reduce((sum, e) => sum + e.amount, 0);
    const currentEstimatedSurplus = roundCurrency(currentRevenue - currentExpenses);
    const currentCostPerBag = calculateOperatingCostPerBag(currentExpenses, currentBagsSold);

    // Previous Month Aggregates
    let prevRevenue = 0;
    let prevBagsSold = 0;
    for (const s of prevSales) {
      prevRevenue += s.totalAmount;
      prevBagsSold += s.items.reduce((sum, i) => sum + i.quantity, 0);
    }
    const prevExpensesSum = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
    const prevGoodBags = prevRuns.reduce((sum, r) => sum + r.goodBags, 0);

    // Growth calculations (%)
    const revenueGrowthPct = prevRevenue > 0 ? roundCurrency(((currentRevenue - prevRevenue) / prevRevenue) * 100) : 0;
    const productionGrowthPct = prevGoodBags > 0 ? roundCurrency(((currentGoodBags - prevGoodBags) / prevGoodBags) * 100) : 0;
    const expensesGrowthPct = prevExpensesSum > 0 ? roundCurrency(((currentExpenses - prevExpensesSum) / prevExpensesSum) * 100) : 0;

    // Mathematical Insights (Section 59)
    const insights: string[] = [];
    if (prevRevenue > 0) {
      insights.push(`Sales revenue ${revenueGrowthPct >= 0 ? "increased" : "decreased"} by ${Math.abs(revenueGrowthPct)}% compared with last month.`);
    } else {
      insights.push(`First tracked operating period recorded GH₵${currentRevenue.toFixed(2)} in sales revenue.`);
    }

    if (currentRejectRate > 0) {
      insights.push(`Production reject rate was ${currentRejectRate}% of total manufactured volume.`);
    }

    if (currentBagsSold > 0) {
      insights.push(`Estimated operating cost per bag was GH₵${currentCostPerBag.toFixed(2)}.`);
    }

    const totalReceivables = allCustomers.reduce((sum, c) => sum + c.currentBalance, 0);
    insights.push(`Outstanding customer trade credit balance stands at GH₵${roundCurrency(totalReceivables).toFixed(2)}.`);

    const totalDebt = activeLoans.reduce((sum, l) => sum + l.currentBalance, 0);

    res.json({
      success: true,
      data: {
        reportHeader: {
          title: "MONTHLY MANAGEMENT REPORT",
          companyName: BUSINESS_INFO.name,
          factoryLocation: BUSINESS_INFO.factoryLocation,
          period: `${reportYear}-${String(reportMonth + 1).padStart(2, "0")}`,
          disclaimer: "MANAGEMENT OPERATIONAL ESTIMATE ONLY. This report represents management operational records and has not been audited by an independent certified public accountant.",
        },
        currentMonth: {
          goodBagsProduced: currentGoodBags,
          bagsProducedTotal: currentProducedBags,
          rejectedBags: currentRejects,
          rejectRate: currentRejectRate,
          bagsSold: currentBagsSold,
          totalRevenue: roundCurrency(currentRevenue),
          creditSales: roundCurrency(currentCreditSales),
          cashExpenses: roundCurrency(currentExpenses),
          estimatedOperatingSurplus: currentEstimatedSurplus,
          costPerBag: currentCostPerBag,
          deliveriesCompleted: currDeliveries.filter((d) => d.status === "DELIVERED").length,
          complaintsRecorded: complaints.length,
          qualityTestsPassed: qualityTests.filter((q) => q.passFail === "PASS").length,
        },
        previousMonth: {
          goodBagsProduced: prevGoodBags,
          bagsSold: prevBagsSold,
          totalRevenue: roundCurrency(prevRevenue),
          cashExpenses: roundCurrency(prevExpensesSum),
        },
        growthIndicators: {
          revenueGrowthPct,
          productionGrowthPct,
          expensesGrowthPct,
        },
        financialPosition: {
          totalTradeReceivables: roundCurrency(totalReceivables),
          activeLiabilities: roundCurrency(totalDebt),
          totalAssetsRegistered: assets.length,
          totalVehicles: vehicles.length,
        },
        insights,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// FINANCING & INVESTOR REPORT (Section 56)
// -------------------------------------------------------------

export async function getInvestorReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [
      allRuns,
      allSales,
      allExpenses,
      customers,
      recurringOrders,
      vehicles,
      assets,
      loans,
      routes,
      qualityTests,
      documents,
    ] = await Promise.all([
      prisma.productionRun.findMany(),
      prisma.sale.findMany({ where: { status: "COMPLETED" }, include: { items: true } }),
      prisma.expense.findMany({ where: { isOwnerWithdrawal: false } }),
      prisma.customer.findMany(),
      prisma.recurringOrder.findMany({ where: { isActive: true }, include: { customer: true } }),
      prisma.vehicle.findMany(),
      prisma.asset.findMany(),
      prisma.loan.findMany({ where: { isManagementConfirmed: true } }),
      prisma.route.findMany(),
      prisma.qualityTest.findMany({ take: 10 }),
      prisma.document.findMany({ where: { status: "ACTIVE" } }),
    ]);

    const totalGoodBagsProduced = allRuns.reduce((sum, r) => sum + r.goodBags, 0);

    let totalBagsSold = 0;
    let totalRevenue = 0;
    for (const s of allSales) {
      totalRevenue += s.totalAmount;
      totalBagsSold += s.items.reduce((sum, i) => sum + i.quantity, 0);
    }

    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalAssetsValue = assets.reduce(
      (sum, a) => sum + (a.currentEstimatedValue || a.originalCost || 0),
      0
    );
    const totalOutstandingReceivables = customers.reduce((sum, c) => sum + c.currentBalance, 0);
    const totalConfirmedLiabilities = loans.reduce((sum, l) => sum + l.currentBalance, 0);

    const recurringPlannedBagsPerCycle = recurringOrders.reduce((sum, ro) => sum + ro.quantity, 0);

    res.json({
      success: true,
      data: {
        reportHeader: {
          title: "FINANCING & INVESTOR REPORT",
          subtitle: "Commercial Profile & Operational Historical Record",
          enterpriseName: BUSINESS_INFO.name,
          legalStructure: BUSINESS_INFO.legalType,
          factoryLocation: BUSINESS_INFO.factoryLocation,
          establishedDate: BUSINESS_INFO.productionStartDate,
          certifiedTrueRecord: true,
        },
        executiveSummary: {
          businessModel: "Borehole abstraction, multi-stage water treatment (resin, carbon, quartz sand), automatic packaging into 500ml sachets (30sachets/bag), and distribution via motorized tricycles and factory gate sales.",
          coreProduct: `${BUSINESS_INFO.mainProduct} (${BUSINESS_INFO.sachetsPerBag} sachets per bag)`,
          standardUnitPrice: `GH₵${BUSINESS_INFO.defaultPricePerBag.toFixed(2)}`,
        },
        operationalTrackRecord: {
          cumulativeBagsManufactured: totalGoodBagsProduced,
          cumulativeBagsSold: totalBagsSold,
          cumulativeGrossRevenue: roundCurrency(totalRevenue),
          cumulativeOperatingExpenses: roundCurrency(totalExpenses),
          cumulativeOperatingSurplus: roundCurrency(totalRevenue - totalExpenses),
        },
        recurringCustomerPortfolio: {
          activeRecurringArrangements: recurringOrders.length,
          plannedVolumePerCycle: recurringPlannedBagsPerCycle,
          keyRecurringAccounts: recurringOrders.map((ro) => ({
            customer: ro.customer.businessName,
            community: ro.customer.community,
            quantityBags: ro.quantity,
            frequency: ro.frequency,
          })),
        },
        distributionInfrastructure: {
          routesCovered: routes.map((r) => r.name),
          fleetCount: vehicles.length,
          primaryVehicle: vehicles[0]?.registrationNumber || "Aboboyaa (Motorized Tricycle)",
        },
        balanceSheetSummary: {
          totalRegisteredAssetsEstimate: roundCurrency(totalAssetsValue),
          totalTradeReceivables: roundCurrency(totalOutstandingReceivables),
          totalConfirmedLiabilities: roundCurrency(totalConfirmedLiabilities),
        },
        complianceAndQualitySummary: {
          activeRegulatoryDocuments: documents.map((d) => ({ code: d.documentCode, title: d.title, category: d.category })),
          recentQualityTests: qualityTests.map((q) => ({ testType: q.testType, result: q.result, passFail: q.passFail })),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// FINANCIAL READINESS CHECKLIST (Section 57)
// -------------------------------------------------------------

export async function getReadinessChecklist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [
      docCategories,
      bankAccountCount,
      salesCount,
      expenseCount,
      cashCount,
      customerCount,
      supplierCount,
      inventoryCount,
      assetCount,
      employeeCount,
      qualityCount,
    ] = await Promise.all([
      prisma.document.findMany({ select: { category: true, expiryDate: true, status: true } }),
      prisma.bankAccount.count(),
      prisma.sale.count(),
      prisma.expense.count(),
      prisma.cashAccount.count(),
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.inventoryItem.count(),
      prisma.asset.count(),
      prisma.employee.count(),
      prisma.qualityTest.count(),
    ]);

    const activeDocCats = docCategories.filter((d) => d.status === "ACTIVE").map((d) => d.category);

    const checklistItems = [
      {
        area: "Business Registration & Legal Status",
        status: activeDocCats.includes("BUSINESS_REGISTRATION") ? "COMPLETE" : "NEEDS_VERIFICATION",
        description: "Registrar General's Department certificate of incorporation / registration",
      },
      {
        area: "Business Bank Account",
        status: bankAccountCount > 0 ? "COMPLETE" : "NEEDS_VERIFICATION",
        description: "Active corporate/business bank account",
      },
      {
        area: "Sales & Invoicing Records",
        status: salesCount > 0 ? "COMPLETE" : "INCOMPLETE",
        description: "Auditable electronic transaction log of all product sales",
      },
      {
        area: "Expense Records & Receipts",
        status: expenseCount > 0 ? "COMPLETE" : "INCOMPLETE",
        description: "Categorized operating expenses and utility payments",
      },
      {
        area: "Daily Cashbook",
        status: cashCount > 0 ? "COMPLETE" : "INCOMPLETE",
        description: "Physical cash counting and reconciliation log",
      },
      {
        area: "Customer CRM & Credit Ledger",
        status: customerCount > 1 ? "COMPLETE" : "INCOMPLETE",
        description: "Individual customer profiles, statements, and credit balances",
      },
      {
        area: "Supplier & Procurement Ledger",
        status: supplierCount > 0 ? "COMPLETE" : "NEEDS_VERIFICATION",
        description: "Active raw material vendor directory and purchase records",
      },
      {
        area: "Inventory Tracking",
        status: inventoryCount > 0 ? "COMPLETE" : "INCOMPLETE",
        description: "Continuous stock movement audit for film rolls, bags, and chemicals",
      },
      {
        area: "Plant Asset Registry",
        status: assetCount > 0 ? "COMPLETE" : "INCOMPLETE",
        description: "Factory equipment, borehole, sachet machine, and vehicles listed",
      },
      {
        area: "Staff & Payroll Records",
        status: employeeCount > 0 ? "COMPLETE" : "INCOMPLETE",
        description: "Employee registry, daily attendance, and salary slips",
      },
      {
        area: "FDA / GSA Regulatory Compliance",
        status: activeDocCats.includes("FDA") || activeDocCats.includes("GSA") ? "COMPLETE" : "NEEDS_VERIFICATION",
        description: "Food and Drugs Authority and Ghana Standards Authority licenses",
      },
      {
        area: "Water Quality Lab Test Reports",
        status: qualityCount > 0 || activeDocCats.includes("WATER_LAB_REPORT") ? "COMPLETE" : "NEEDS_VERIFICATION",
        description: "Accredited laboratory physicochemical and microbiological certificates",
      },
    ];

    const completedCount = checklistItems.filter((i) => i.status === "COMPLETE").length;
    const readinessScorePct = Math.round((completedCount / checklistItems.length) * 100);

    res.json({
      success: true,
      data: {
        checklistItems,
        readinessScorePct,
        completedCount,
        totalItems: checklistItems.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
