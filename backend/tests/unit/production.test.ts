import { test } from "node:test";
import assert from "node:assert/strict";
import { productionMetrics } from "../../src/modules/production/production.logic.js";
const base = { date: "2026-01-05", bagsProduced: 300, rejectedBags: 4, machineHours: 6, downtimeMinutes: 0 };
test("overnight shifts use next-day end and exclude downtime", () => {
  const value = productionMetrics({ ...base, startTime: "22:00", endTime: "04:00", downtimeMinutes: 60 });
  assert.equal(value.machineHours, 5); assert.equal(value.goodBags, 296);
  assert.equal(value.endTime?.toISOString(), "2026-01-06T04:00:00.000Z");
  assert.equal(value.productionPerHour, 59.2);
});
test("rejects invalid dates, excessive rejects, equal times and impossible downtime", () => {
  for (const input of [{ date: "2026-02-30" }, { rejectedBags: 301 }, { startTime: "08:00", endTime: "08:00" }, { startTime: "08:00", endTime: "09:00", downtimeMinutes: 60 }]) {
    assert.throws(() => productionMetrics({ ...base, ...input }));
  }
});
