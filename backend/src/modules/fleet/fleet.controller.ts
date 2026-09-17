import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";
import {
  calculateTripDistance,
  calculateFuelCostPerKm,
  calculateDeliveryCostPerBag,
  roundCurrency,
} from "../../utils/calculations.js";

export const createVehicleSchema = z.object({
  registrationNumber: z.string().min(2),
  vehicleType: z.enum(["ABOBOYAA_TRICYCLE", "CARGO_TRUCK", "VAN", "OTHER"]).default("ABOBOYAA_TRICYCLE"),
  makeModel: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.number().nonnegative().optional(),
  currentEstimatedValue: z.number().nonnegative().optional(),
  assignedDriverId: z.string().uuid().optional(),
  currentOdometer: z.number().nonnegative().default(0.0),
  insuranceExpiry: z.string().optional(),
  roadworthyExpiry: z.string().optional(),
  serviceIntervalKm: z.number().positive().default(1500.0),
});

export const recordTripSchema = z.object({
  vehicleId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  startOdometer: z.number().nonnegative(),
  endOdometer: z.number().nonnegative(),
  bagsCarried: z.number().int().positive(),
  bagsDelivered: z.number().int().nonnegative(),
  fuelLitres: z.number().nonnegative().default(0.0),
  fuelCost: z.number().nonnegative().default(0.0),
  revenueCollected: z.number().nonnegative().default(0.0),
  cashCollected: z.number().nonnegative().default(0.0),
  creditCreated: z.number().nonnegative().default(0.0),
  notes: z.string().optional(),
});

export const recordFuelSchema = z.object({
  vehicleId: z.string().uuid(),
  fuelType: z.enum(["PETROL", "DIESEL"]).default("PETROL"),
  litres: z.number().positive(),
  pricePerLitre: z.number().positive(),
  odometer: z.number().nonnegative().optional(),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const recordMaintenanceSchema = z.object({
  vehicleId: z.string().uuid(),
  serviceType: z.string(),
  description: z.string().min(3),
  technician: z.string().optional(),
  partsCost: z.number().nonnegative().default(0.0),
  laborCost: z.number().nonnegative().default(0.0),
  odometer: z.number().nonnegative().optional(),
  nextServiceKm: z.number().positive().optional(),
  nextServiceDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function getVehicles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        assignedDriver: true,
        _count: {
          select: {
            trips: true,
            fuelRecords: true,
            maintenance: true,
            deliveries: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { vehicles },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createVehicle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: data.registrationNumber,
        vehicleType: data.vehicleType,
        makeModel: data.makeModel || null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchaseCost: data.purchaseCost || null,
        currentEstimatedValue: data.currentEstimatedValue || null,
        assignedDriverId: data.assignedDriverId || null,
        currentOdometer: data.currentOdometer || 0.0,
        insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : null,
        roadworthyExpiry: data.roadworthyExpiry ? new Date(data.roadworthyExpiry) : null,
        serviceIntervalKm: data.serviceIntervalKm || 1500.0,
        status: "ACTIVE",
      },
    });

    await logAudit({
      action: "CREATE",
      module: "fleet",
      recordId: vehicle.id,
      newValue: vehicle,
      req,
    });

    res.status(201).json({
      success: true,
      data: { vehicle },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrips(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { vehicleId, driverId } = req.query;
    const where: Record<string, unknown> = {};
    if (vehicleId && typeof vehicleId === "string") where.vehicleId = vehicleId;
    if (driverId && typeof driverId === "string") where.driverId = driverId;

    const trips = await prisma.vehicleTrip.findMany({
      where,
      orderBy: { tripDate: "desc" },
      include: { vehicle: true, driver: true, route: true },
    });

    res.json({
      success: true,
      data: { trips },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const distanceKm = calculateTripDistance(data.startOdometer, data.endOdometer);
    const fuelCostPerKm = calculateFuelCostPerKm(data.fuelCost, distanceKm);
    const deliveryCostPerBag = calculateDeliveryCostPerBag(data.fuelCost, data.bagsDelivered);

    const trip = await prisma.$transaction(async (tx) => {
      const createdTrip = await tx.vehicleTrip.create({
        data: {
          vehicleId: data.vehicleId,
          driverId: data.driverId || null,
          routeId: data.routeId || null,
          startOdometer: data.startOdometer,
          endOdometer: data.endOdometer,
          distanceKm,
          bagsCarried: data.bagsCarried,
          bagsDelivered: data.bagsDelivered,
          fuelLitres: data.fuelLitres,
          fuelCost: data.fuelCost,
          revenueCollected: data.revenueCollected,
          cashCollected: data.cashCollected,
          creditCreated: data.creditCreated,
          fuelCostPerKm,
          deliveryCostPerBag,
          notes: data.notes || null,
        },
        include: { vehicle: true, route: true },
      });

      // Update vehicle current odometer
      await tx.vehicle.update({
        where: { id: data.vehicleId },
        data: { currentOdometer: data.endOdometer },
      });

      return createdTrip;
    });

    await logAudit({
      action: "CREATE",
      module: "fleet_trips",
      recordId: trip.id,
      newValue: trip,
      req,
    });

    res.status(201).json({
      success: true,
      data: { trip },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordFuel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;
    const totalCost = roundCurrency(data.litres * data.pricePerLitre);

    const fuelRecord = await prisma.$transaction(async (tx) => {
      const fuel = await tx.vehicleFuel.create({
        data: {
          vehicleId: data.vehicleId,
          fuelType: data.fuelType,
          litres: data.litres,
          pricePerLitre: data.pricePerLitre,
          totalCost,
          odometer: data.odometer || null,
          receiptNumber: data.receiptNumber || null,
          recordedBy: req.user?.username || null,
          notes: data.notes || null,
        },
      });

      // Automatically create an Expense record for vehicle fuel
      const count = await tx.expense.count();
      const expenseNumber = `NSP-EXP-${String(count + 1).padStart(4, "0")}`;

      await tx.expense.create({
        data: {
          expenseNumber,
          date: new Date(),
          category: data.fuelType === "PETROL" ? "FUEL_PETROL" : "FUEL_DIESEL",
          description: `Vehicle fuel: ${data.litres}L @ GH₵${data.pricePerLitre}/L for vehicle`,
          payee: "Fuel Station",
          amount: totalCost,
          paymentMethod: "CASH",
          receiptNumber: data.receiptNumber || null,
          recordedBy: req.user?.username || null,
        },
      });

      return fuel;
    });

    res.status(201).json({
      success: true,
      data: { fuelRecord },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordMaintenance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;
    const totalCost = roundCurrency(data.partsCost + data.laborCost);

    const record = await prisma.vehicleMaintenance.create({
      data: {
        vehicleId: data.vehicleId,
        serviceType: data.serviceType,
        description: data.description,
        technician: data.technician || null,
        partsCost: data.partsCost,
        laborCost: data.laborCost,
        totalCost,
        odometer: data.odometer || null,
        nextServiceKm: data.nextServiceKm || null,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : null,
        notes: data.notes || null,
      },
    });

    res.status(201).json({
      success: true,
      data: { maintenanceRecord: record },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
