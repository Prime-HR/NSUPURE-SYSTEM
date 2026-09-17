import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sachetsToBags,
  calculateRevenue,
  calculateCreditCreated,
  calculateGoodBags,
  calculateRejectRate,
  calculateProductionPerHour,
  calculateExpectedClosingCash,
  calculateCashDifference,
  calculateClosingStock,
  calculateTripDistance,
  calculateFuelCostPerKm,
  calculateDeliveryCostPerBag,
  calculateOperatingCostPerBag,
} from "../../src/utils/calculations.js";

describe("Nsupure Core Business Math & Calculations", () => {
  it("should correctly convert 30 sachets into 1 bag", () => {
    const res1 = sachetsToBags(30);
    assert.equal(res1.fullBags, 1);
    assert.equal(res1.remainingSachets, 0);

    const res2 = sachetsToBags(95);
    assert.equal(res2.fullBags, 3);
    assert.equal(res2.remainingSachets, 5);

    const res3 = sachetsToBags(0);
    assert.equal(res3.fullBags, 0);
    assert.equal(res3.remainingSachets, 0);
  });

  it("should calculate sales revenue: Quantity * Unit Price", () => {
    // 20 bags at GH₵7.00
    assert.equal(calculateRevenue(20, 7.0), 140.0);
    // 300 bags at GH₵7.00
    assert.equal(calculateRevenue(300, 7.0), 2100.0);
    // Custom price GH₵6.50 for wholesaler
    assert.equal(calculateRevenue(100, 6.5), 650.0);
  });

  it("should calculate credit created accurately", () => {
    // Total GH₵140, paid GH₵100 -> GH₵40 credit
    assert.equal(calculateCreditCreated(140.0, 100.0), 40.0);
    // Total GH₵140, fully paid GH₵140 -> GH₵0 credit
    assert.equal(calculateCreditCreated(140.0, 140.0), 0.0);
    // Total GH₵140, zero paid -> GH₵140 credit
    assert.equal(calculateCreditCreated(140.0, 0.0), 140.0);
    // Advance payment (paid GH₵200 on GH₵140) -> 0 credit
    assert.equal(calculateCreditCreated(140.0, 200.0), 0.0);
  });

  it("should calculate good bags and reject rates correctly", () => {
    // 300 bags produced, 5 rejects -> 295 good bags
    const good = calculateGoodBags(300, 5);
    assert.equal(good, 295);

    // Reject rate: (5 / 300) * 100 = 1.67%
    const rate = calculateRejectRate(300, 5);
    assert.equal(rate, 1.67);

    // 0 rejects -> 0.00%
    assert.equal(calculateRejectRate(300, 0), 0.0);
  });

  it("should calculate production per machine hour", () => {
    // 295 good bags in 4 machine hours -> 73.8 bags/hr
    const rate = calculateProductionPerHour(295, 4.0);
    assert.equal(rate, 73.8);

    // 0 hours -> 0
    assert.equal(calculateProductionPerHour(295, 0), 0);
  });

  it("should calculate expected closing cash and reconciliation discrepancy", () => {
    // Opening: 500, Cash in: 2100, Cash out: 450 -> Expected: 2150
    const expected = calculateExpectedClosingCash(500, 2100, 450);
    assert.equal(expected, 2150);

    // Exact count: 2150 -> 0 difference
    assert.equal(calculateCashDifference(2150, expected), 0.0);

    // Shortage: physical 2100 counted -> -50 difference
    assert.equal(calculateCashDifference(2100, expected), -50.0);

    // Surplus: physical 2180 counted -> +30 difference
    assert.equal(calculateCashDifference(2180, expected), 30.0);
  });

  it("should calculate inventory closing stock with all movement types", () => {
    // Opening: 50 rolls, Purchases: 20, Usage: 15, Damage: 2, Adjustment: +1 -> 54
    const closing = calculateClosingStock(50, 20, 15, 2, 1);
    assert.equal(closing, 54);
  });

  it("should calculate vehicle trip metrics (distance, fuel/km, cost/bag)", () => {
    // Odometer 120.0 to 145.5 -> 25.5 km
    const dist = calculateTripDistance(120.0, 145.5);
    assert.equal(dist, 25.5);

    // Fuel cost GH₵60 on 25.5 km -> GH₵2.35/km
    const fuelPerKm = calculateFuelCostPerKm(60.0, 25.5);
    assert.equal(fuelPerKm, 2.35);

    // Trip cost GH₵60 on 60 bags delivered -> GH₵1.00/bag
    const deliveryPerBag = calculateDeliveryCostPerBag(60.0, 60);
    assert.equal(deliveryPerBag, 1.0);
  });

  it("should calculate operating cost per bag from relevant costs", () => {
    // Relevant expenses GH₵1,500 over 300 bags sold -> GH₵5.00/bag
    const costPerBag = calculateOperatingCostPerBag(1500.0, 300);
    assert.equal(costPerBag, 5.0);
  });
});
