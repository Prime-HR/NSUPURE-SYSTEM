import { BUSINESS_INFO } from "../config/constants.js";

/**
 * Packaging conversion: Converts individual sachets to bags (30 sachets per bag).
 */
export function sachetsToBags(sachets: number): { fullBags: number; remainingSachets: number } {
  if (sachets < 0) {
    throw new Error("Sachet count cannot be negative");
  }
  const ratio = BUSINESS_INFO.sachetsPerBag;
  return {
    fullBags: Math.floor(sachets / ratio),
    remainingSachets: sachets % ratio,
  };
}

/**
 * Calculates total sales revenue: Quantity * Unit Price
 */
export function calculateRevenue(quantity: number, unitPrice: number): number {
  if (quantity < 0 || unitPrice < 0) {
    throw new Error("Quantity and unit price must not be negative");
  }
  return roundCurrency(quantity * unitPrice);
}

/**
 * Calculates credit amount created: Total - Amount Received
 */
export function calculateCreditCreated(totalAmount: number, amountReceived: number): number {
  if (totalAmount < 0 || amountReceived < 0) {
    throw new Error("Total amount and amount received must not be negative");
  }
  const credit = totalAmount - amountReceived;
  return roundCurrency(credit > 0 ? credit : 0);
}

/**
 * Calculates good bags produced: Produced Bags - Rejected Bags
 */
export function calculateGoodBags(bagsProduced: number, rejectedBags: number): number {
  if (bagsProduced < 0 || rejectedBags < 0) {
    throw new Error("Produced bags and rejected bags must not be negative");
  }
  if (rejectedBags > bagsProduced) {
    throw new Error("Rejected bags cannot exceed total bags produced");
  }
  return bagsProduced - rejectedBags;
}

/**
 * Calculates production reject rate percentage: (Rejected / Produced) * 100
 */
export function calculateRejectRate(bagsProduced: number, rejectedBags: number): number {
  if (bagsProduced === 0) return 0;
  if (bagsProduced < 0 || rejectedBags < 0) {
    throw new Error("Values must not be negative");
  }
  const rate = (rejectedBags / bagsProduced) * 100;
  return Number(rate.toFixed(2));
}

/**
 * Calculates production per machine hour: Good Bags / Machine Hours
 */
export function calculateProductionPerHour(goodBags: number, machineHours: number): number {
  if (machineHours <= 0) return 0;
  if (goodBags < 0) {
    throw new Error("Good bags cannot be negative");
  }
  return Number((goodBags / machineHours).toFixed(1));
}

/**
 * Calculates expected closing cash: Opening + Money In - Money Out
 */
export function calculateExpectedClosingCash(
  openingCash: number,
  moneyIn: number,
  moneyOut: number
): number {
  return roundCurrency(openingCash + moneyIn - moneyOut);
}

/**
 * Calculates physical cash difference / discrepancy:
 * Physical Counted Cash - Expected Closing Cash
 * Positive = Surplus, Negative = Shortage
 */
export function calculateCashDifference(
  actualPhysicalCash: number,
  expectedClosingCash: number
): number {
  return roundCurrency(actualPhysicalCash - expectedClosingCash);
}

/**
 * Calculates inventory closing stock:
 * Opening + Purchases - Usage - Damage + Adjustments
 */
export function calculateClosingStock(
  openingStock: number,
  purchases: number,
  usage: number,
  damage: number,
  adjustments: number = 0
): number {
  if (openingStock < 0 || purchases < 0 || usage < 0 || damage < 0) {
    throw new Error("Stock movement components (except adjustment) must not be negative");
  }
  const closing = openingStock + purchases - usage - damage + adjustments;
  return Number(closing.toFixed(2));
}

/**
 * Calculates vehicle trip distance: End Odometer - Start Odometer
 */
export function calculateTripDistance(startOdometer: number, endOdometer: number): number {
  if (endOdometer < startOdometer) {
    throw new Error("End odometer cannot be less than start odometer");
  }
  return Number((endOdometer - startOdometer).toFixed(1));
}

/**
 * Calculates fuel cost per kilometer: Total Fuel Cost / Distance (km)
 */
export function calculateFuelCostPerKm(fuelCost: number, distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  return Number((fuelCost / distanceKm).toFixed(2));
}

/**
 * Calculates delivery cost per bag: Total Trip Costs / Bags Delivered
 */
export function calculateDeliveryCostPerBag(tripCosts: number, bagsDelivered: number): number {
  if (bagsDelivered <= 0) return 0;
  return Number((tripCosts / bagsDelivered).toFixed(2));
}

/**
 * Calculates estimated operating cost per bag:
 * Relevant Operating Costs / Good Bags Sold
 */
export function calculateOperatingCostPerBag(
  relevantOperatingCosts: number,
  goodBagsSold: number
): number {
  if (goodBagsSold <= 0) return 0;
  return Number((relevantOperatingCosts / goodBagsSold).toFixed(2));
}

/**
 * Standard rounding to 2 decimal places for Ghanaian Cedis (GHS)
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
