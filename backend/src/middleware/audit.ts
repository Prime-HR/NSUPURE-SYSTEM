import { Request } from "express";
import { prisma } from "../utils/prisma.js";

export interface LogAuditOptions {
  userId?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "VOID" | "APPROVE" | "LOGIN" | "EXPORT";
  module: string;
  recordId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  req?: Request;
}

export async function logAudit(options: LogAuditOptions): Promise<void> {
  try {
    const ipAddress =
      options.req?.headers["x-forwarded-for"]?.toString() ||
      options.req?.socket?.remoteAddress ||
      null;
    const userAgent = options.req?.headers["user-agent"] || null;

    await prisma.auditLog.create({
      data: {
        userId: options.userId ?? (options.req?.user?.id || null),
        action: options.action,
        module: options.module,
        recordId: options.recordId || null,
        oldValue: options.oldValue ? JSON.stringify(options.oldValue) : null,
        newValue: options.newValue ? JSON.stringify(options.newValue) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // Audit logging failure should not crash the transaction, but must be logged
    console.error("[AUDIT LOG ERROR]", err);
  }
}
