import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
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
  checklist: z.record(z.boolean()), // { productionRoom: true, machine: true, tanks: true, ... }
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

    const test = await prisma.qualityTest.create({
      data: {
        batchId: data.batchId || null,
        testType: data.testType,
        parameter: data.parameter,
        specificationReference: data.specificationReference,
        result: data.result,
        passFail: data.passFail,
        laboratory: data.laboratory || null,
        tester: data.tester || req.user?.username || null,
        certificateNumber: data.certificateNumber || null,
        nextTestDate: data.nextTestDate ? new Date(data.nextTestDate) : null,
        notes: data.notes || null,
      },
      include: { batch: true },
    });

    await logAudit({
      action: "CREATE",
      module: "quality",
      recordId: test.id,
      newValue: test,
      req,
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
    const allCompleted = Object.values(checklist).every((val) => val === true);

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
