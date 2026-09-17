import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";
import {
  calculateGoodBags,
  calculateRejectRate,
  calculateProductionPerHour,
} from "../../utils/calculations.js";

export const createProductionRunSchema = z.object({
  shift: z.enum(["MORNING_8_12", "AFTERNOON_1_5"]).default("MORNING_8_12"),
  productId: z.string().uuid().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  machineHours: z.number().positive("Machine operating hours must be positive").default(4.0),
  openingRawWaterLevel: z.number().nonnegative().optional(),
  closingRawWaterLevel: z.number().nonnegative().optional(),
  openingPurifiedWaterLevel: z.number().nonnegative().optional(),
  closingPurifiedWaterLevel: z.number().nonnegative().optional(),
  bagsProduced: z.number().int().nonnegative("Bags produced must be non-negative"),
  rejectedBags: z.number().int().nonnegative("Rejected bags must be non-negative").default(0),
  packagingUsedRolls: z.number().nonnegative().default(0.0),
  outerBagsUsed: z.number().int().nonnegative().default(0),
  downtimeMinutes: z.number().int().nonnegative().default(0),
  downtimeReason: z.string().optional(),
  notes: z.string().optional(),
});

export const recordWasteSchema = z.object({
  wasteType: z.enum(["DAMAGED_SACHETS", "REJECTED_BAGS", "PACKAGING_WASTE", "FILTER_RESIDUE"]).default("REJECTED_BAGS"),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.enum(["BAGS", "PIECES", "KG"]).default("BAGS"),
  reason: z.string().optional(),
  batchId: z.string().uuid().optional(),
  dispositionMethod: z.string().optional(),
  notes: z.string().optional(),
});

export async function getProductionRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = req.query;
    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(String(startDate));
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(String(endDate));
    }

    const runs = await prisma.productionRun.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        operator: { select: { id: true, username: true, fullName: true } },
        product: true,
        batches: true,
      },
    });

    res.json({
      success: true,
      data: { runs },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createProductionRun(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    // Default product if not supplied
    let productId = data.productId;
    if (!productId) {
      const defaultProd = await prisma.product.findFirst({ where: { isActive: true } });
      if (!defaultProd) {
        throw new AppError("No active product found in system", 400, "NO_PRODUCT");
      }
      productId = defaultProd.id;
    }

    // Mathematical calculations
    const goodBags = calculateGoodBags(data.bagsProduced, data.rejectedBags);
    const rejectRatePct = calculateRejectRate(data.bagsProduced, data.rejectedBags);
    const productionPerHour = calculateProductionPerHour(goodBags, data.machineHours);

    // Today's date string YYYY-MM-DD
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    // Count today's runs for sequential batch number: NSP-YYYY-MM-DD-001
    const todayRunsCount = await prisma.productionRun.count({
      where: {
        date: {
          gte: new Date(`${dateStr}T00:00:00.000Z`),
          lte: new Date(`${dateStr}T23:59:59.999Z`),
        },
      },
    });

    const runNumber = `RUN-${dateStr}-${String(todayRunsCount + 1).padStart(2, "0")}`;
    const batchNumber = `NSP-${dateStr}-${String(todayRunsCount + 1).padStart(3, "0")}`;

    // Expiry date (e.g. 2 months for packaged sachet water)
    const expiryDate = new Date(today);
    expiryDate.setMonth(expiryDate.getMonth() + 2);

    // ATOMIC TRANSACTION: Create run, batch, decrement packaging inventory if tracked
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Production Run
      const run = await tx.productionRun.create({
        data: {
          runNumber,
          date: today,
          shift: data.shift,
          operatorId: req.user?.id || null,
          productId,
          startTime: data.startTime ? new Date(data.startTime) : null,
          endTime: data.endTime ? new Date(data.endTime) : null,
          machineHours: data.machineHours,
          openingRawWaterLevel: data.openingRawWaterLevel || null,
          closingRawWaterLevel: data.closingRawWaterLevel || null,
          openingPurifiedWaterLevel: data.openingPurifiedWaterLevel || null,
          closingPurifiedWaterLevel: data.closingPurifiedWaterLevel || null,
          bagsProduced: data.bagsProduced,
          rejectedBags: data.rejectedBags,
          goodBags,
          rejectRatePct,
          productionPerHour,
          packagingUsedRolls: data.packagingUsedRolls,
          outerBagsUsed: data.outerBagsUsed,
          downtimeMinutes: data.downtimeMinutes,
          downtimeReason: data.downtimeReason || null,
          qcStatus: "PASSED",
          notes: data.notes || null,
        },
        include: { product: true },
      });

      // 2. Create Production Batch for full traceability (Section 26)
      const batch = await tx.productionBatch.create({
        data: {
          batchNumber,
          productionRunId: run.id,
          productionDate: today,
          expiryDate,
          totalGoodBags: goodBags,
          remainingBags: goodBags,
          qcStatus: "PASSED",
          notes: `Batch produced during shift ${data.shift}`,
        },
      });

      // 3. Link batch ID to run
      await tx.productionRun.update({
        where: { id: run.id },
        data: { batchId: batch.id },
      });

      // 4. Record waste if rejected bags > 0
      if (data.rejectedBags > 0) {
        await tx.productionWaste.create({
          data: {
            date: today,
            wasteType: "REJECTED_BAGS",
            quantity: data.rejectedBags,
            unit: "BAGS",
            reason: "Defective sealing or packaging during filling",
            batchId: batch.id,
            dispositionMethod: "SCRAPPED",
            responsiblePersonId: req.user?.id || null,
          },
        });
      }

      return { run, batch };
    });

    await logAudit({
      action: "CREATE",
      module: "production",
      recordId: result.run.id,
      newValue: {
        runNumber,
        batchNumber,
        bagsProduced: data.bagsProduced,
        goodBags,
        rejectedBags: data.rejectedBags,
        rejectRatePct,
      },
      req,
    });

    res.status(201).json({
      success: true,
      data: {
        run: result.run,
        batch: result.batch,
        metrics: {
          goodBags,
          rejectRatePct,
          productionPerHour,
        },
      },
      message: `Production recorded: ${goodBags} good bags, Batch ${batchNumber}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const batches = await prisma.productionBatch.findMany({
      orderBy: { productionDate: "desc" },
      include: {
        productionRun: { include: { product: true } },
        qualityTests: true,
        wasteRecords: true,
        complaints: true,
      },
    });

    res.json({
      success: true,
      data: { batches },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordWaste(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const waste = await prisma.productionWaste.create({
      data: {
        date: new Date(),
        wasteType: data.wasteType,
        quantity: data.quantity,
        unit: data.unit,
        reason: data.reason || null,
        batchId: data.batchId || null,
        dispositionMethod: data.dispositionMethod || "DISPOSED",
        responsiblePersonId: req.user?.id || null,
        notes: data.notes || null,
      },
    });

    res.status(201).json({
      success: true,
      data: { waste },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
