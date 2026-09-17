import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma.js";

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { module, action, userId, startDate, endDate } = req.query;
    const where: Record<string, unknown> = {};

    if (module && typeof module === "string") where.module = module;
    if (action && typeof action === "string") where.action = action;
    if (userId && typeof userId === "string") where.userId = userId;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) (where.timestamp as Record<string, unknown>).gte = new Date(String(startDate));
      if (endDate) (where.timestamp as Record<string, unknown>).lte = new Date(String(endDate));
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, username: true, fullName: true } },
      },
    });

    res.json({
      success: true,
      data: { logs },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
