import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { SANITATION_AREAS } from "../../config/constants.js";
import { logAudit } from "../../middleware/audit.js";

export const recordQualityTestSchema = z.object({
  batchId: z.string().uuid().optional(),
  testType: z.enum(["MICROBIOLOGICAL", "PHYSICOCHEMICAL", "PH", "NET_VOLUME", "CONDUCTIVITY", "OTHER"]),
  parameter: z.string().min(2),
  specificationReference: z.string().min(2, "Reference standard (e.g. GS 175-1 / FDA Ghana) is required"),
  result: z.string().min(1),
  passFail: z.enum(["PASS", "FAIL"]).default("PASS"),
  laboratory: z.string().optional(),
  tester: z.string().optional(),
  certificateNumber: z.string().optional(),
  nextTestDate: z.string().optional(),
  notes: z.string().optional(),
});

export const recordCleaningSchema = z.object({
  checklist: z.record(z.boolean()).refine(value => SANITATION_AREAS.every(area => typeof value[area] === "boolean"), "All nine sanitation checkpoints are required"), // { productionRoom: true, machine: true, tanks: true, ... }
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
});

export const createComplaintSchema = z.object({
  customerId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  category: z.enum(["TASTE_SMELL", "PACKAGING", "SEAL_LEAK", "QUANTITY", "DELIVERY", "CUSTOMER_SERVICE", "OTHER"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  description: z.string().min(5),
  immediateAction: z.string().optional(),
  responsiblePerson: z.string().optional(),
});

export const resolveComplaintSchema = z.object({
  rootCause: z.string().min(3),
  correctiveAction: z.string().min(3),
  status: z.enum(["RESOLVED", "CLOSED"]).default("RESOLVED"),
});

// -------------------------------------------------------------
// QUALITY TESTS (Section 43)
// -------------------------------------------------------------

export async function getQualityTests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tests = await prisma.qualityTest.findMany({
      orderBy: { testDate: "desc" },
      include: { batch: true },
    });

    res.json({
      success: true,
      data: { tests },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordQualityTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const test = await prisma.$transaction(async tx => {
      const batch = data.batchId ? await tx.productionBatch.findUnique({ where: { id: data.batchId } }) : null;
      if (data.batchId && (!batch || batch.voidedAt)) throw new AppError("Select an active production batch.", 400, "INVALID_BATCH");
      const test = await tx.qualityTest.create({ data: {
        batchId: data.batchId || null, testType: data.testType, parameter: data.parameter,
        specificationReference: data.specificationReference, result: data.result, passFail: data.passFail,
        laboratory: data.laboratory || null, tester: req.user!.username,
        certificateNumber: data.certificateNumber || null,
        nextTestDate: data.nextTestDate ? new Date(data.nextTestDate) : null, notes: data.notes || null,
      }, include: { batch: true } });
      if (batch) {
        // Any new evidence withdraws release until reviewed; a failure quarantines.
        const qcStatus = data.passFail === "FAIL" ? "FAILED" : "PENDING";
        await tx.productionBatch.update({ where: { id: batch.id }, data: { qcStatus } });
        if (batch.productionRunId) await tx.productionRun.update({ where: { id: batch.productionRunId }, data: { qcStatus, version: { increment: 1 } } });
      }
      await tx.auditLog.create({ data: { userId: req.user!.id, action: "CREATE", module: "quality", recordId: test.id, newValue: JSON.stringify(test) } });
      return test;
    });

    res.status(201).json({
      success: true,
      data: { test },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// DAILY SANITATION CHECKLIST (Section 44)
// -------------------------------------------------------------

export async function getCleaningRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const records = await prisma.cleaningRecord.findMany({
      orderBy: { date: "desc" },
      take: 30,
    });

    res.json({
      success: true,
      data: { cleaningRecords: records },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function recordCleaning(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { checklist, notes, photoUrl } = req.body;

    // Verify all standard sanitation checkpoints are checked
    const allCompleted = SANITATION_AREAS.every(area => checklist[area] === true);

    const record = await prisma.cleaningRecord.create({
      data: {
        date: new Date(),
        time: new Date().toLocaleTimeString(),
        checklistJson: JSON.stringify(checklist),
        completed: allCompleted,
        verifiedById: req.user?.username || null,
        photoUrl: photoUrl || null,
        notes: notes || null,
      },
    });

    await logAudit({
      action: "CREATE",
      module: "sanitation",
      recordId: record.id,
      newValue: { completed: allCompleted },
      req,
    });

    res.status(201).json({
      success: true,
      data: { cleaningRecord: record },
      message: "Daily sanitation checklist recorded successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// COMPLAINTS & CORRECTIVE ACTIONS (Section 46)
// -------------------------------------------------------------

export async function getComplaints(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, severity } = req.query;
    const where: Record<string, unknown> = {};
    if (status && typeof status === "string") where.status = status;
    if (severity && typeof severity === "string") where.severity = severity;

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: { dateReceived: "desc" },
      include: { customer: true, batch: true },
    });

    res.json({
      success: true,
      data: { complaints },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createComplaint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const count = await prisma.complaint.count();
    const complaintNumber = `NSP-CMP-${String(count + 1).padStart(4, "0")}`;

    const complaint = await prisma.complaint.create({
      data: {
        complaintNumber,
        customerId: data.customerId || null,
        batchId: data.batchId || null,
        category: data.category,
        severity: data.severity,
        description: data.description,
        immediateAction: data.immediateAction || null,
        responsiblePerson: data.responsiblePerson || null,
        status: "OPEN",
      },
      include: { customer: true, batch: true },
    });

    await logAudit({
      action: "CREATE",
      module: "complaints",
      recordId: complaint.id,
      newValue: complaint,
      req,
    });

    res.status(201).json({
      success: true,
      data: { complaint },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function resolveComplaint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { rootCause, correctiveAction, status } = req.body;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      throw new AppError("Complaint not found", 404, "NOT_FOUND");
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        rootCause,
        correctiveAction,
        resolutionDate: new Date(),
        status,
      },
    });

    await logAudit({
      action: "UPDATE",
      module: "complaints",
      recordId: id,
      oldValue: complaint,
      newValue: updated,
      req,
    });

    res.json({
      success: true,
      data: { complaint: updated },
      message: `Complaint ${complaint.complaintNumber} marked as ${status}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export const releaseBatchSchema = z.object({ reason: z.string().trim().min(5).max(1000) });
export async function releaseBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await prisma.$transaction(async tx => {
      const existing = await tx.productionBatch.findUnique({ where: { id: req.params.id }, include: { qualityTests: { orderBy: { testDate: "desc" } }, productionRun: true } });
      if (!existing || existing.voidedAt) throw new AppError("Active batch not found", 404, "NOT_FOUND");
      const config = await tx.setting.findUnique({ where: { key: "qc_required_test_types" } });
      const required = config?.value.split(",").map(value => value.trim()).filter(Boolean);
      if (!required?.length) throw new AppError("Management must configure qc_required_test_types before batches can be released.", 409, "QC_POLICY_REQUIRED");
      const lastCorrection = existing.productionRunId ? await tx.auditLog.findFirst({ where: { module: "production", recordId: existing.productionRunId, action: "UPDATE" }, orderBy: { timestamp: "desc" } }) : null;
      const tests = existing.qualityTests.filter(test => !lastCorrection || test.testDate >= lastCorrection.timestamp);
      const latest = new Map<string, typeof tests[number]>();
      for (const test of tests) if (!latest.has(`${test.testType}:${test.parameter.trim().toLowerCase()}`)) latest.set(`${test.testType}:${test.parameter.trim().toLowerCase()}`, test);
      if (required.some(type => !Array.from(latest.values()).some(test => test.testType === type && test.passFail === "PASS")) || Array.from(latest.values()).some(test => test.passFail !== "PASS")) {
        throw new AppError("All required test types must have passing results after the latest production correction.", 409, "QC_INCOMPLETE");
      }
      const updated = await tx.productionBatch.update({ where: { id: existing.id }, data: { qcStatus: "PASSED" } });
      if (existing.productionRunId) await tx.productionRun.update({ where: { id: existing.productionRunId }, data: { qcStatus: "PASSED", version: { increment: 1 } } });
      await tx.auditLog.create({ data: { userId: req.user!.id, action: "APPROVE", module: "quality", recordId: updated.id, oldValue: JSON.stringify({ qcStatus: existing.qcStatus }), newValue: JSON.stringify({ qcStatus: "PASSED", reason: req.body.reason, required, testIds: Array.from(latest.values()).map(test => test.id) }) } });
      return updated;
    }, { isolationLevel: "Serializable" });
    res.json({ success: true, data: { batch }, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
}
