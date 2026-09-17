import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { logAudit } from "../../middleware/audit.js";

export const createDocumentSchema = z.object({
  title: z.string().min(3),
  category: z.string(),
  documentNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  relatedEntityType: z.enum(["CUSTOMER", "VEHICLE", "EMPLOYEE", "ASSET", "SUPPLIER", "LOAN"]).optional(),
  relatedEntityId: z.string().uuid().optional(),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  changeDescription: z.string().optional(),
});

export const createNewVersionSchema = z.object({
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  changeDescription: z.string().min(3, "Change description is required for new version"),
  expiryDate: z.string().optional(),
});

export async function getDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { category, status, relatedEntityType, relatedEntityId } = req.query;
    const where: Record<string, unknown> = {};

    if (category && typeof category === "string") where.category = category;
    if (status && typeof status === "string") where.status = status;
    if (relatedEntityType && typeof relatedEntityType === "string") where.relatedEntityType = relatedEntityType;
    if (relatedEntityId && typeof relatedEntityId === "string") where.relatedEntityId = relatedEntityId;

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    res.json({
      success: true,
      data: { documents },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function createDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = req.body;

    const count = await prisma.document.count();
    const documentCode = `NSP-DOC-${String(count + 1).padStart(4, "0")}`;

    const doc = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          documentCode,
          title: data.title,
          category: data.category,
          documentNumber: data.documentNumber || null,
          issueDate: data.issueDate ? new Date(data.issueDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          relatedEntityType: data.relatedEntityType || null,
          relatedEntityId: data.relatedEntityId || null,
          status: "ACTIVE",
          versions: {
            create: {
              versionNumber: 1,
              fileName: data.fileName,
              filePath: data.filePath,
              fileSize: data.fileSize,
              mimeType: data.mimeType,
              changeDescription: data.changeDescription || "Initial upload",
              uploadedBy: req.user?.username || null,
            },
          },
        },
        include: { versions: true },
      });

      // Update currentVersionId
      const currentVer = document.versions[0];
      await tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: currentVer.id },
      });

      return document;
    });

    await logAudit({
      action: "CREATE",
      module: "documents",
      recordId: doc.id,
      newValue: doc,
      req,
    });

    res.status(201).json({
      success: true,
      data: { document: doc },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Adds a new version to an existing document without overwriting previous versions
 */
export async function addDocumentVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });

    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    const latestVersionNum = document.versions[0]?.versionNumber || 1;
    const nextVersionNum = latestVersionNum + 1;

    const result = await prisma.$transaction(async (tx) => {
      const newVersion = await tx.documentVersion.create({
        data: {
          documentId: id,
          versionNumber: nextVersionNum,
          fileName: data.fileName,
          filePath: data.filePath,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          changeDescription: data.changeDescription,
          uploadedBy: req.user?.username || null,
        },
      });

      await tx.document.update({
        where: { id },
        data: {
          currentVersionId: newVersion.id,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : document.expiryDate,
        },
      });

      return newVersion;
    });

    await logAudit({
      action: "UPDATE",
      module: "documents",
      recordId: id,
      newValue: { versionNumber: nextVersionNum },
      req,
    });

    res.status(201).json({
      success: true,
      data: { version: result },
      message: `Version ${nextVersionNum} added successfully for ${document.title}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns documents expiring within the next 30 days
 */
export async function getExpiringDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000);

    const expiring = await prisma.document.findMany({
      where: {
        expiryDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        status: "ACTIVE",
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    res.json({
      success: true,
      data: { expiringDocuments: expiring },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
