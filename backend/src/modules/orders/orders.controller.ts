import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";

export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  requiredDeliveryDate: z.string().optional(),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  deliveryLocation: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive("Quantity must be positive"),
      unitPrice: z.number().positive("Unit price must be positive"),
    })
  ).min(1, "Order must have at least one product item"),
});

export const recurringOrderSchema = z.object({
  customerId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  frequency: z.enum([
    "DAILY",
    "EVERY_2_DAYS",
    "EVERY_3_DAYS",
    "EVERY_4_DAYS",
    "WEEKLY",
    "BIWEEKLY",
    "MONTHLY",
    "CUSTOM",
  ]),
  customIntervalDays: z.number().int().positive().optional(),
  unitPrice: z.number().positive().default(7.0),
  startDate: z.string(),
  endDate: z.string().optional(),
  deliveryDay: z.string().optional(),
  deliveryLocation: z.string().optional(),
  notes: z.string().optional(),
});

export async function getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, customerId } = req.query;
    const where: Record<string, unknown> = {};

    if (status && typeof status === "string") where.status = status;
    if (customerId && typeof customerId === "string") where.customerId = customerId;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { orderDate: "desc" },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    res.json({
      success: true,
      data: { orders },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const count = await prisma.order.count();
    const orderNumber = `NSP-ORD-${String(count + 1).padStart(4, "0")}`;

    let totalAmount = 0;
    for (const item of data.items) {
      totalAmount += item.quantity * item.unitPrice;
    }
    totalAmount = Math.round((totalAmount + Number.EPSILON) * 100) / 100;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        requiredDeliveryDate: data.requiredDeliveryDate ? new Date(data.requiredDeliveryDate) : null,
        status: "CONFIRMED",
        paymentStatus: "PENDING",
        totalAmount,
        amountPaid: 0.0,
        balanceDue: totalAmount,
        vehicleId: data.vehicleId || null,
        driverId: data.driverId || null,
        deliveryLocation: data.deliveryLocation || null,
        notes: data.notes || null,
        createdBy: req.user?.username || null,
        items: {
          create: data.items.map((i: { productId: string; quantity: number; unitPrice: number }) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: Math.round((i.quantity * i.unitPrice + Number.EPSILON) * 100) / 100,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "orders",
      recordId: order.id,
      newValue: order,
      req,
    });

    res.status(201).json({
      success: true,
      data: { order },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "DRAFT",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "PARTIALLY_DELIVERED",
      "CANCELLED",
    ];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status: ${status}`, 400, "INVALID_STATUS");
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: { customer: true, items: true },
    });

    await logAudit({
      action: "UPDATE",
      module: "orders",
      recordId: id,
      newValue: { status },
      req,
    });

    res.json({
      success: true,
      data: { order },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// RECURRING ORDER SCHEDULES (Section 22)
// -------------------------------------------------------------

export async function getRecurringOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const recurring = await prisma.recurringOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });

    res.json({
      success: true,
      data: { recurringOrders: recurring },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createRecurringOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const recurring = await prisma.recurringOrder.create({
      data: {
        customerId: data.customerId,
        productId: data.productId,
        quantity: data.quantity,
        frequency: data.frequency,
        customIntervalDays: data.customIntervalDays || null,
        unitPrice: data.unitPrice,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        deliveryDay: data.deliveryDay || null,
        deliveryLocation: data.deliveryLocation || null,
        notes: data.notes || null,
        isActive: true,
      },
      include: { customer: true },
    });

    await logAudit({
      action: "CREATE",
      module: "recurring_orders",
      recordId: recurring.id,
      newValue: recurring,
      req,
    });

    res.status(201).json({
      success: true,
      data: { recurringOrder: recurring },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generates an actual confirmed planned order from a recurring schedule.
 * As per Section 9 & 22: "A recurring schedule creates a planned order.
 * Actual sales and deliveries must be recorded separately."
 */
export async function generateOrderFromRecurring(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const recurring = await prisma.recurringOrder.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!recurring || !recurring.isActive) {
      throw new AppError("Active recurring order schedule not found", 404, "NOT_FOUND");
    }

    const count = await prisma.order.count();
    const orderNumber = `NSP-ORD-REC-${String(count + 1).padStart(4, "0")}`;
    const totalAmount = Math.round((recurring.quantity * recurring.unitPrice + Number.EPSILON) * 100) / 100;

    const plannedOrder = await prisma.order.create({
      data: {
        orderNumber,
        customerId: recurring.customerId,
        orderDate: new Date(),
        status: "CONFIRMED",
        paymentStatus: "PENDING",
        totalAmount,
        amountPaid: 0.0,
        balanceDue: totalAmount,
        deliveryLocation: recurring.deliveryLocation,
        notes: `Generated from recurring supply schedule (${recurring.frequency})`,
        createdBy: req.user?.username,
        items: {
          create: [
            {
              productId: recurring.productId,
              quantity: recurring.quantity,
              unitPrice: recurring.unitPrice,
              totalPrice: totalAmount,
            },
          ],
        },
      },
      include: { items: true, customer: true },
    });

    await prisma.recurringOrder.update({
      where: { id },
      data: { lastGeneratedDate: new Date() },
    });

    res.status(201).json({
      success: true,
      data: { order: plannedOrder },
      message: `Generated planned order ${plannedOrder.orderNumber} for ${recurring.customer.businessName}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
