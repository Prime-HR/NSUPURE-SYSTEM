import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";

export const createDeliverySchema = z.object({
  customerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  bagsAssigned: z.number().int().positive("Bags assigned must be positive"),
  departureTime: z.string().optional(),
  notes: z.string().optional(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum([
    "SCHEDULED",
    "LOADING",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "PARTIALLY_DELIVERED",
    "FAILED",
    "CANCELLED",
  ]),
  bagsDelivered: z.number().int().nonnegative().optional(),
  paymentCollected: z.number().nonnegative().optional(),
  creditCreated: z.number().nonnegative().optional(),
  customerConfirmationName: z.string().optional(),
  failureReason: z.string().optional(),
  notes: z.string().optional(),
});

export async function getDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, customerId, driverId, vehicleId, date } = req.query;
    const where: Record<string, unknown> = {};

    if (status && typeof status === "string") where.status = status;
    if (customerId && typeof customerId === "string") where.customerId = customerId;
    if (driverId && typeof driverId === "string") where.driverId = driverId;
    if (vehicleId && typeof vehicleId === "string") where.vehicleId = vehicleId;
    if (date && typeof date === "string") {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.deliveryDate = { gte: startOfDay, lte: endOfDay };
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      orderBy: { deliveryDate: "desc" },
      include: {
        customer: true,
        order: true,
        route: true,
        vehicle: true,
        driver: true,
      },
    });

    res.json({
      success: true,
      data: { deliveries },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const count = await prisma.delivery.count();
    const deliveryNumber = `NSP-DEL-${String(count + 1).padStart(4, "0")}`;

    const delivery = await prisma.delivery.create({
      data: {
        deliveryNumber,
        customerId: data.customerId,
        orderId: data.orderId || null,
        routeId: data.routeId || null,
        vehicleId: data.vehicleId || null,
        driverId: data.driverId || null,
        bagsAssigned: data.bagsAssigned,
        bagsDelivered: 0,
        departureTime: data.departureTime ? new Date(data.departureTime) : null,
        status: "SCHEDULED",
        notes: data.notes || null,
      },
      include: {
        customer: true,
        vehicle: true,
        driver: true,
        route: true,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "deliveries",
      recordId: delivery.id,
      newValue: delivery,
      req,
    });

    res.status(201).json({
      success: true,
      data: { delivery },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDeliveryStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.delivery.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Delivery record not found", 404, "NOT_FOUND");
    }

    const updatePayload: Record<string, unknown> = {
      status: data.status,
    };

    if (data.status === "OUT_FOR_DELIVERY" && !existing.departureTime) {
      updatePayload.departureTime = new Date();
    }
    if (data.status === "DELIVERED" || data.status === "PARTIALLY_DELIVERED") {
      updatePayload.arrivalTime = new Date();
      if (typeof data.bagsDelivered === "number") {
        updatePayload.bagsDelivered = data.bagsDelivered;
      } else {
        updatePayload.bagsDelivered = existing.bagsAssigned;
      }
      if (typeof data.paymentCollected === "number") {
        updatePayload.paymentCollected = data.paymentCollected;
      }
      if (typeof data.creditCreated === "number") {
        updatePayload.creditCreated = data.creditCreated;
      }
      if (data.customerConfirmationName) {
        updatePayload.customerConfirmationName = data.customerConfirmationName;
      }
    }
    if (data.status === "FAILED") {
      updatePayload.failureReason = data.failureReason || "Delivery attempt failed";
    }
    if (data.notes) {
      updatePayload.notes = data.notes;
    }

    const updated = await prisma.delivery.update({
      where: { id },
      data: updatePayload,
      include: { customer: true, vehicle: true, driver: true },
    });

    await logAudit({
      action: "UPDATE",
      module: "deliveries",
      recordId: id,
      oldValue: existing,
      newValue: updated,
      req,
    });

    res.json({
      success: true,
      data: { delivery: updated },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// ROUTES MANAGEMENT (Section 24)
// -------------------------------------------------------------

export async function getRoutes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const routes = await prisma.route.findMany({
      include: {
        _count: {
          select: {
            deliveries: true,
            vehicleTrips: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { routes },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, name, targetCommunities, distanceKm, estimatedFuelLitres } = req.body;

    const route = await prisma.route.create({
      data: {
        code,
        name,
        targetCommunities,
        distanceKm: distanceKm || null,
        estimatedFuelLitres: estimatedFuelLitres || null,
        isActive: true,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "routes",
      recordId: route.id,
      newValue: route,
      req,
    });

    res.status(201).json({
      success: true,
      data: { route },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
