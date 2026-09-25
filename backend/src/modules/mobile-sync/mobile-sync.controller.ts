import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../utils/prisma.js";
import { AppError } from "../../middleware/error-handler.js";

const entity = z.enum(["productions", "loadings", "customers", "orders", "debtors"]);
const eventSchema = z.object({
  eventId: z.string().min(8).max(120),
  entity,
  entityId: z.string().min(1).max(120),
  action: z.enum(["CREATE", "UPDATE", "VOID", "RESTORE"]),
  payload: z.record(z.unknown()).refine(value => JSON.stringify(value).length <= 50_000, "Payload is too large"),
  occurredAt: z.string().datetime(),
});
const batchSchema = z.object({ deviceId: z.string().min(8).max(120), events: z.array(eventSchema).min(1).max(100) });

const rolesAllowed = ["OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR", "SALES", "DRIVER", "FINANCE"];
function requireMobileAccess(req: Request) {
  if (!req.user || !req.user.roles.some(role => rolesAllowed.includes(role))) throw new AppError("You do not have access to mobile synchronization", 403, "FORBIDDEN");
}

export async function pushMobileEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireMobileAccess(req);
    const body = batchSchema.parse(req.body);
    let accepted = 0;
    for (const event of body.events) {
      const created = await prisma.mobileSyncEvent.upsert({
        where: { deviceId_eventId: { deviceId: body.deviceId, eventId: event.eventId } },
        create: { deviceId: body.deviceId, eventId: event.eventId, entity: event.entity, entityId: event.entityId, action: event.action, payload: JSON.stringify(event.payload), occurredAt: new Date(event.occurredAt), userId: req.user!.id },
        update: {},
      });
      if (created.deviceId === body.deviceId && created.eventId === event.eventId) accepted++;
    }
    res.status(202).json({ success: true, data: { accepted, serverTime: new Date().toISOString() } });
  } catch (error) { next(error); }
}

export async function pullMobileEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireMobileAccess(req);
    const after = typeof req.query.after === "string" ? new Date(req.query.after) : new Date(0);
    if (Number.isNaN(after.getTime())) throw new AppError("Invalid sync cursor", 400, "VALIDATION_ERROR");
    const events = await prisma.mobileSyncEvent.findMany({ where: { receivedAt: { gt: after } }, orderBy: { receivedAt: "asc" }, take: 500 });
    res.json({ success: true, data: { events: events.map(event => ({ ...event, payload: JSON.parse(event.payload) })), serverTime: new Date().toISOString() } });
  } catch (error) { next(error); }
}
