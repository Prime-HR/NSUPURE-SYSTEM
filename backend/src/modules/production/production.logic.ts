import { AppError } from "../../middleware/error-handler.js";

interface ProductionInput {
  date?: string; startTime?: string; endTime?: string; machineHours: number;
  bagsProduced: number; rejectedBags: number; downtimeMinutes: number;
}
export function productionMetrics(data: ProductionInput) {
  const day = data.date || new Date().toISOString().slice(0, 10);
  const date = new Date(`${day}T00:00:00.000Z`);
  const invalid = (message: string): never => { throw new AppError(message, 400, "INVALID_PRODUCTION"); };
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) invalid("Enter a valid production date.");
  if (day > new Date().toISOString().slice(0, 10)) invalid("Production date cannot be in the future.");
  if (data.rejectedBags > data.bagsProduced) invalid("Rejected bags cannot exceed total production.");
  if (!!data.startTime !== !!data.endTime) invalid("Enter both shift start and end times.");
  let startTime: Date | null = null;
  let endTime: Date | null = null;
  let machineHours = data.machineHours;
  if (data.startTime && data.endTime) {
    startTime = new Date(`${day}T${data.startTime}:00.000Z`);
    endTime = new Date(`${day}T${data.endTime}:00.000Z`);
    if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())) invalid("Invalid shift time.");
    if (endTime.getTime() === startTime.getTime()) invalid("Shift start and end cannot be equal.");
    if (endTime < startTime) endTime.setUTCDate(endTime.getUTCDate() + 1);
    const elapsedMinutes = (endTime.getTime() - startTime.getTime()) / 60000;
    if (data.downtimeMinutes >= elapsedMinutes) invalid("Downtime must be shorter than the shift.");
    machineHours = (elapsedMinutes - data.downtimeMinutes) / 60;
  } else if (data.downtimeMinutes >= machineHours * 60) {
    invalid("Downtime must be shorter than the recorded working period.");
  }
  if (!Number.isFinite(machineHours) || machineHours <= 0 || machineHours > 24) invalid("Operating hours must be greater than zero and at most 24.");
  const goodBags = data.bagsProduced - data.rejectedBags;
  return { date, startTime, endTime, machineHours, goodBags,
    rejectRatePct: data.bagsProduced ? Math.round(data.rejectedBags / data.bagsProduced * 10000) / 100 : 0,
    productionPerHour: Math.round(goodBags / machineHours * 100) / 100 };
}
