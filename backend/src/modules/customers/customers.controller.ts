import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";

export const createCustomerSchema = z.object({
  businessName: z.string().min(2, "Business or customer name is required"),
  contactPerson: z.string().optional(),
  customerType: z.string().default("INDIVIDUAL"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  community: z.string().optional(),
  address: z.string().optional(),
  gpsLocation: z.string().optional(),
  normalOrderQty: z.number().int().nonnegative().optional().default(0),
  preferredDeliveryDay: z.string().optional(),
  preferredDeliveryTime: z.string().optional(),
  customPrice: z.number().positive().optional(),
  creditLimit: z.number().nonnegative().optional().default(0.0),
  creditTermsDays: z.number().int().nonnegative().optional().default(3),
  notes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export async function getCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, community, customerType, status } = req.query;

    const where: Record<string, unknown> = {};

    if (status && typeof status === "string") {
      where.status = status;
    }
    if (community && typeof community === "string") {
      where.community = community;
    }
    if (customerType && typeof customerType === "string") {
      where.customerType = customerType;
    }
    if (search && typeof search === "string") {
      where.OR = [
        { businessName: { contains: search } },
        { customerCode: { contains: search } },
        { phone: { contains: search } },
        { contactPerson: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { businessName: "asc" },
      include: {
        _count: {
          select: {
            sales: true,
            orders: true,
            deliveries: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { customers },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        agreements: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { items: { include: { product: true } } },
        },
        sales: {
          orderBy: { saleDate: "desc" },
          take: 10,
          include: { items: { include: { product: true } }, payments: true },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          take: 10,
        },
        deliveries: {
          orderBy: { deliveryDate: "desc" },
          take: 10,
        },
        complaints: {
          orderBy: { dateReceived: "desc" },
        },
      },
    });

    if (!customer) {
      throw new AppError("Customer not found", 404, "NOT_FOUND");
    }

    // Aggregates
    const salesAggregate = await prisma.sale.aggregate({
      where: { customerId: id, status: "COMPLETED" },
      _sum: {
        totalAmount: true,
        amountReceived: true,
        creditAmount: true,
      },
      _count: { id: true },
    });

    const bagsAggregate = await prisma.saleItem.aggregate({
      where: { sale: { customerId: id, status: "COMPLETED" } },
      _sum: { quantity: true },
    });

    res.json({
      success: true,
      data: {
        customer,
        metrics: {
          totalBagsPurchased: bagsAggregate._sum.quantity || 0,
          totalSalesAmount: salesAggregate._sum.totalAmount || 0,
          totalPaid: salesAggregate._sum.amountReceived || 0,
          outstandingBalance: customer.currentBalance,
          totalTransactions: salesAggregate._count.id || 0,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    // Generate unique sequential customer code e.g. NSP-CUST-001
    const count = await prisma.customer.count();
    const customerCode = `NSP-CUST-${String(count + 1).padStart(3, "0")}`;

    const customer = await prisma.customer.create({
      data: {
        customerCode,
        businessName: data.businessName,
        contactPerson: data.contactPerson || null,
        customerType: data.customerType || "INDIVIDUAL",
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        email: data.email || null,
        community: data.community || null,
        address: data.address || null,
        gpsLocation: data.gpsLocation || null,
        normalOrderQty: data.normalOrderQty ?? 0,
        preferredDeliveryDay: data.preferredDeliveryDay || null,
        preferredDeliveryTime: data.preferredDeliveryTime || null,
        customPrice: data.customPrice || null,
        creditLimit: data.creditLimit ?? 0.0,
        creditTermsDays: data.creditTermsDays ?? 3,
        currentBalance: 0.0,
        status: "ACTIVE",
        notes: data.notes || null,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "customers",
      recordId: customer.id,
      newValue: customer,
      req,
    });

    res.status(201).json({
      success: true,
      data: { customer },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Customer not found", 404, "NOT_FOUND");
    }

    const updated = await prisma.customer.update({
      where: { id },
      data,
    });

    await logAudit({
      action: "UPDATE",
      module: "customers",
      recordId: id,
      oldValue: existing,
      newValue: updated,
      req,
    });

    res.json({
      success: true,
      data: { customer: updated },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Customer Statement generator (Section 17)
 * Returns structured ledger entries: Date | Reference | Description | Debit | Credit | Balance
 */
export async function getCustomerStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new AppError("Customer not found", 404, "NOT_FOUND");
    }

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(String(startDate));
    if (endDate) dateFilter.lte = new Date(String(endDate));

    // Fetch all sales (Debits) and payments (Credits)
    const sales = await prisma.sale.findMany({
      where: {
        customerId: id,
        status: "COMPLETED",
        ...(Object.keys(dateFilter).length > 0 ? { saleDate: dateFilter } : {}),
      },
      include: { items: { include: { product: true } } },
      orderBy: { saleDate: "asc" },
    });

    const payments = await prisma.payment.findMany({
      where: {
        customerId: id,
        ...(Object.keys(dateFilter).length > 0 ? { paymentDate: dateFilter } : {}),
      },
      orderBy: { paymentDate: "asc" },
    });

    interface StatementEntry {
      date: Date;
      reference: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }

    const rawEntries: Array<{
      date: Date;
      reference: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    for (const s of sales) {
      const totalBags = s.items.reduce((sum, item) => sum + item.quantity, 0);
      rawEntries.push({
        date: s.saleDate,
        reference: s.saleNumber,
        description: `Invoice: ${totalBags} bags sachet water`,
        debit: s.totalAmount,
        credit: 0,
      });
    }

    for (const p of payments) {
      rawEntries.push({
        date: p.paymentDate,
        reference: p.paymentNumber,
        description: `Payment received (${p.paymentMethod})${p.referenceNumber ? ` Ref: ${p.referenceNumber}` : ""}`,
        debit: 0,
        credit: p.amount,
      });
    }

    // Sort chronologically
    rawEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    let totalPurchases = 0;
    let totalPayments = 0;

    const statementEntries: StatementEntry[] = [];

    for (const e of rawEntries) {
      runningBalance = runningBalance + e.debit - e.credit;
      totalPurchases += e.debit;
      totalPayments += e.credit;

      statementEntries.push({
        ...e,
        balance: Math.round((runningBalance + Number.EPSILON) * 100) / 100,
      });
    }

    res.json({
      success: true,
      data: {
        statementTitle: "CUSTOMER STATEMENT",
        enterpriseName: "NSUPURE MINERAL WATER ENTERPRISE",
        factoryLocation: "Adumasa, Juaben Constituency, Ashanti Region, Ghana",
        customer: {
          id: customer.id,
          code: customer.customerCode,
          name: customer.businessName,
          contact: customer.contactPerson,
          phone: customer.phone,
          community: customer.community,
        },
        period: {
          startDate: startDate || "Inception",
          endDate: endDate || new Date().toISOString().split("T")[0],
        },
        entries: statementEntries,
        summary: {
          totalPurchases: Math.round((totalPurchases + Number.EPSILON) * 100) / 100,
          totalPayments: Math.round((totalPayments + Number.EPSILON) * 100) / 100,
          outstandingBalance: Math.round((runningBalance + Number.EPSILON) * 100) / 100,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
