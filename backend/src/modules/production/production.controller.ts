import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { productionMetrics } from "./production.logic.js";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
const productionFields = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shift: z.string().trim().min(1).max(80).default("MORNING_6_12"),
  productId: z.string().uuid().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  machineHours: z.number().positive("Machine operating hours must be positive").max(24).default(6.0),
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

export const createProductionRunSchema = productionFields.superRefine((data, ctx) => {
  try { productionMetrics(data); } catch (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message });
  }
});
export const updateProductionRunSchema = productionFields.extend({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(5).max(1000),
}).superRefine((data, ctx) => {
  try { productionMetrics(data); } catch (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: (error as Error).message });
  }
});
export const voidProductionRunSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(5).max(1000),
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
    const where: Record<string, unknown> = req.query.includeVoided === "true" ? {} : { voidedAt: null };

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
    const header = req.get("Idempotency-Key");
    if (header && !z.string().uuid().safeParse(header).success) throw new AppError("Invalid request identifier", 400, "INVALID_REQUEST_ID");
    const requestId = header ? `${req.user!.id}:${header}` : null;
    const requestHash = requestId ? createHash("sha256").update(JSON.stringify(data)).digest("hex") : null;
    const replay = requestId ? await prisma.productionRun.findUnique({ where: { requestId }, include: { batches: true } }) : null;
    if (replay) {
      if (replay.requestHash !== requestHash) throw new AppError("This request identifier was already used with different production data.", 409, "REQUEST_CONFLICT");
      res.json({ success: true, data: { run: replay, batch: replay.batches[0] }, replayed: true, timestamp: new Date().toISOString() }); return;
    }

    // Default product if not supplied
    let productId = data.productId;
    if (!productId) {
      const defaultProd = await prisma.product.findFirst({ where: { isActive: true } });
      if (!defaultProd) {
        throw new AppError("No active product found in system", 400, "NO_PRODUCT");
      }
      productId = defaultProd.id;
    }

    const metrics = productionMetrics(data);
    const { date: today, startTime, endTime, machineHours, goodBags, rejectRatePct, productionPerHour } = metrics;
    const dateStr = today.toISOString().slice(0, 10);
    // Independent of record counts; safe across simultaneous writers and corrections.
    const suffix = randomUUID();
    const runNumber = `RUN-${dateStr}-${suffix}`;
    const batchNumber = `NSP-${dateStr}-${suffix}`;

    // Expiry date (e.g. 2 months for packaged sachet water)
    const expiryDate = new Date(today);
    expiryDate.setMonth(expiryDate.getMonth() + 2);

    // Atomically retain the run, batch, waste and audit snapshot.
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Production Run
      const run = await tx.productionRun.create({
        data: {
          runNumber, requestId, requestHash,
          date: today,
          shift: data.shift,
          operatorId: req.user?.id || null,
          productId,
          startTime,
          endTime,
          machineHours,
          openingRawWaterLevel: data.openingRawWaterLevel ?? null,
          closingRawWaterLevel: data.closingRawWaterLevel ?? null,
          openingPurifiedWaterLevel: data.openingPurifiedWaterLevel ?? null,
          closingPurifiedWaterLevel: data.closingPurifiedWaterLevel ?? null,
          bagsProduced: data.bagsProduced,
          rejectedBags: data.rejectedBags,
          goodBags,
          rejectRatePct,
          productionPerHour,
          packagingUsedRolls: data.packagingUsedRolls,
          outerBagsUsed: data.outerBagsUsed,
          downtimeMinutes: data.downtimeMinutes,
          downtimeReason: data.downtimeReason || null,
          qcStatus: "PENDING",
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
          qcStatus: "PENDING",
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

      await tx.auditLog.create({ data: {
        userId: req.user!.id, action: "CREATE", module: "production", recordId: run.id,
        newValue: JSON.stringify({ run, batch }),
      } });
      return { run, batch };
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
    if ((error as { code?: string }).code === "P2002" && req.get("Idempotency-Key")) {
      next(new AppError("This request is already being saved. Retry with the same request identifier.", 409, "REQUEST_IN_PROGRESS"));
    } else next(error);
  }
}

export async function getBatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const batches = await prisma.productionBatch.findMany({
      where: { voidedAt: null },
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

// No hard-delete route: both corrections and removal preserve snapshots atomically.
async function correctProduction(req: Request, res: Response, next: NextFunction, voiding: boolean) {
  try {
    const { expectedVersion, reason } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      const old = await tx.productionRun.findUnique({
        where: { id: req.params.id }, include: { batches: { include: { wasteRecords: true } } },
      });
      if (!old) throw new AppError("Production run not found", 404, "NOT_FOUND");
      if (old.voidedAt) throw new AppError("This production entry is already deleted. Its history is retained.", 409, "ALREADY_VOIDED");
      if (old.version !== expectedVersion) throw new AppError("Another user changed this entry. Reload before correcting it.", 409, "VERSION_CONFLICT");
      if (old.batches.length !== 1) throw new AppError("This entry requires a reviewed stock correction because its batch linkage is incomplete.", 409, "BATCH_REVIEW_REQUIRED");
      if (!voiding && req.body.productId && req.body.productId !== old.productId) throw new AppError("Product cannot be changed on an existing batch.", 409, "PRODUCT_LOCKED");
      const batch = old.batches[0];
      const input = { ...req.body, date: req.body.date || old.date.toISOString().slice(0, 10) };
      const metrics = voiding ? null : productionMetrics(input);
      if (metrics && metrics.date.toISOString().slice(0, 10) === old.date.toISOString().slice(0, 10)) metrics.date = old.date;
      const stockChanged = voiding || metrics!.goodBags !== old.goodBags || input.rejectedBags !== old.rejectedBags ||
        input.packagingUsedRolls !== old.packagingUsedRolls || input.outerBagsUsed !== old.outerBagsUsed ||
        metrics!.date.toISOString().slice(0, 10) !== old.date.toISOString().slice(0, 10);
      if (stockChanged) {
        // Legacy sales/deliveries have no reliable batch allocation. Never infer that
        // remainingBags means unused stock when downstream records may exist.
        const [sale, delivery] = await Promise.all([
          tx.sale.findFirst({ where: { status: "COMPLETED", saleDate: { gte: old.date }, items: { some: { productId: old.productId } } } }),
          tx.delivery.findFirst({ where: { deliveryDate: { gte: old.date }, status: { notIn: ["CANCELLED", "FAILED"] } } }),
        ]);
        if (batch.remainingBags !== batch.totalGoodBags || sale || delivery) {
          throw new AppError("Stock may already be sold or assigned to a delivery. Reconcile the linked stock before changing quantities, dates or deleting this entry. Shift times and notes can still be corrected.", 409, "STOCK_REVIEW_REQUIRED");
        }
      }
      const now = new Date();
      const data = voiding ? { voidedAt: now, voidReason: reason, version: { increment: 1 } } : {
        date: metrics!.date, shift: input.shift, startTime: metrics!.startTime, endTime: metrics!.endTime,
        machineHours: metrics!.machineHours, bagsProduced: input.bagsProduced, rejectedBags: input.rejectedBags,
        goodBags: metrics!.goodBags, rejectRatePct: metrics!.rejectRatePct, productionPerHour: metrics!.productionPerHour,
        openingRawWaterLevel: input.openingRawWaterLevel ?? null, closingRawWaterLevel: input.closingRawWaterLevel ?? null,
        openingPurifiedWaterLevel: input.openingPurifiedWaterLevel ?? null, closingPurifiedWaterLevel: input.closingPurifiedWaterLevel ?? null,
        packagingUsedRolls: input.packagingUsedRolls, outerBagsUsed: input.outerBagsUsed,
        downtimeMinutes: input.downtimeMinutes, downtimeReason: input.downtimeReason || null, notes: input.notes || null,
        qcStatus: "PENDING", version: { increment: 1 },
      };
      const changed = await tx.productionRun.updateMany({ where: { id: old.id, version: expectedVersion, voidedAt: null }, data });
      if (changed.count !== 1) throw new AppError("Another user changed this entry. Reload and try again.", 409, "VERSION_CONFLICT");
      const expiryDate = metrics ? new Date(metrics.date) : batch.expiryDate;
      if (metrics) expiryDate.setUTCMonth(expiryDate.getUTCMonth() + 2);
      await tx.productionBatch.update({ where: { id: batch.id }, data: voiding ? { voidedAt: now } : {
        totalGoodBags: metrics!.goodBags, remainingBags: batch.remainingBags + metrics!.goodBags - old.goodBags,
        productionDate: metrics!.date,
        ...(metrics!.date.getTime() !== old.date.getTime() ? { expiryDate } : {}),
        qcStatus: "PENDING",
      } });
      // Preserve old waste rows; corrections are append-only, with a signed delta.
      const delta = voiding ? -old.rejectedBags : input.rejectedBags - old.rejectedBags;
      if (delta !== 0) await tx.productionWaste.create({ data: {
        batchId: batch.id, wasteType: "PRODUCTION_CORRECTION", quantity: delta, unit: "BAGS",
        reason, dispositionMethod: "RECORD_CORRECTION", responsiblePersonId: req.user!.id,
        notes: `Correction to ${old.runNumber}; this adjusts recorded rejects, not physical waste.`,
      } });
      const run = await tx.productionRun.findUniqueOrThrow({ where: { id: old.id }, include: { batches: true } });
      await tx.auditLog.create({ data: {
        userId: req.user!.id, action: voiding ? "VOID" : "UPDATE", module: "production", recordId: old.id,
        oldValue: JSON.stringify(old), newValue: JSON.stringify({ reason, run }),
      } });
      return { run, batch: run.batches[0] };
    }, { isolationLevel: "Serializable" });
    res.json({ success: true, data: result, message: voiding ? "Production entry deleted from active totals; original data and history retained." : "Production correction saved.", timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
}
export async function updateProductionRun(req: Request, res: Response, next: NextFunction) {
  return correctProduction(req, res, next, false);
}
export async function voidProductionRun(req: Request, res: Response, next: NextFunction) {
  return correctProduction(req, res, next, true);
}
export async function getProductionHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const history = await prisma.auditLog.findMany({ where: { module: "production", recordId: req.params.id }, orderBy: { timestamp: "desc" } });
    res.json({ success: true, data: { history }, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
}

export async function restoreProductionRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { expectedVersion, reason } = req.body;
    const run = await prisma.$transaction(async tx => {
      const old = await tx.productionRun.findUnique({ where: { id: req.params.id }, include: { batches: true } });
      if (!old) throw new AppError("Production run not found", 404, "NOT_FOUND");
      if (!old.voidedAt || old.version !== expectedVersion) throw new AppError("Entry changed or is already active. Reload before restoring.", 409, "VERSION_CONFLICT");
      if (old.batches.length !== 1) throw new AppError("Batch linkage requires review before restoration.", 409, "BATCH_REVIEW_REQUIRED");
      const updated = await tx.productionRun.updateMany({ where: { id: old.id, version: expectedVersion, voidedAt: { not: null } }, data: { voidedAt: null, voidReason: null, qcStatus: "PENDING", version: { increment: 1 } } });
      if (updated.count !== 1) throw new AppError("Entry changed. Reload before restoring.", 409, "VERSION_CONFLICT");
      await tx.productionBatch.update({ where: { id: old.batches[0].id }, data: { voidedAt: null, qcStatus: "PENDING" } });
      if (old.rejectedBags) await tx.productionWaste.create({ data: { batchId: old.batches[0].id, wasteType: "PRODUCTION_CORRECTION", quantity: old.rejectedBags, unit: "BAGS", reason, dispositionMethod: "RECORD_CORRECTION", responsiblePersonId: req.user!.id, notes: `Restored ${old.runNumber}` } });
      const run = await tx.productionRun.findUniqueOrThrow({ where: { id: old.id }, include: { batches: true } });
      await tx.auditLog.create({ data: { userId: req.user!.id, action: "UPDATE", module: "production", recordId: old.id, oldValue: JSON.stringify(old), newValue: JSON.stringify({ operation: "RESTORE", reason, run }) } });
      return run;
    }, { isolationLevel: "Serializable" });
    res.json({ success: true, data: { run }, message: "Production entry restored; quality review required.", timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
}
