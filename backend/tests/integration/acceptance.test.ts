import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../../src/app.js";
import { prisma } from "../../src/utils/prisma.js";

let server: http.Server;
let baseUrl: string;
let authToken: string;

describe("Section 91: Nsupure Day-In-The-Life End-To-End Acceptance Walkthrough", () => {
  before(async () => {
    // Start test server on dynamic port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await prisma.$disconnect();
  });

  test("Step 1: Secure Authentication - Owner Login", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "owner",
        password: "Nsupure2025!",
      }),
    });

    assert.equal(res.status, 200, "Login should succeed with HTTP 200");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.token, "Token must be returned");
    authToken = body.data.token;
  });

  test("Step 2: Morning Opening Cashbook Count & Factory Readiness", async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/cashbook`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.account, "Primary cash account must exist");
  });

  let createdBatchId: string;
  test("Step 3: Production Run - 300 Bags Produced, 4 Reject Bags, Water & Packaging Consumed", async () => {
    const res = await fetch(`${baseUrl}/api/v1/production/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shift: "MORNING_8_12",
        machineHours: 4.0,
        openingRawWaterLevel: 1000,
        closingRawWaterLevel: 100,
        openingPurifiedWaterLevel: 1000,
        closingPurifiedWaterLevel: 100,
        bagsProduced: 300,
        rejectedBags: 4,
        packagingUsedRolls: 0.5,
        outerBagsUsed: 300,
        notes: "Smooth morning shift operation at Adumasa factory",
      }),
    });

    assert.equal(res.status, 201, "Production run should be created");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.run.bagsProduced, 300);
    assert.equal(body.data.run.rejectedBags, 4);
    assert.equal(body.data.run.goodBags, 296);
    // Reject rate: (4 / 300) * 100 = 1.33%
    assert.ok(body.data.run.rejectRatePct > 1.3 && body.data.run.rejectRatePct < 1.4);
    assert.ok(body.data.batch, "Batch must be created automatically");
    assert.ok(body.data.batch.batchNumber.startsWith("NSP-"), "Batch number must start with NSP-");
    createdBatchId = body.data.batch.id;
  });

  test("Step 4: Quality Control Sample Testing (pH, TDS, Seal Integrity)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/quality/tests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batchId: createdBatchId,
        testType: "PH",
        parameter: "Water pH & TDS",
        specificationReference: "GS 175-1 / FDA Ghana Sachet Standard",
        result: "pH: 7.1, TDS: 42 ppm, Odor: None, Taste: Clean, Seal: Intact",
        passFail: "PASS",
        laboratory: "Internal Adumasa In-House QC Lab",
        tester: "Quality Assurance Officer",
        notes: "Conforms to GS 175-1 Ghana standard",
      }),
    });

    assert.equal(res.status, 201, "Quality test should be recorded");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.test.passFail, "PASS");
  });

  test("Step 5: Daily Sanitation Checklist Across All 9 Designated Areas", async () => {
    const res = await fetch(`${baseUrl}/api/v1/quality/sanitation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checklist: {
          "Production Room": true,
          "Filling & Sealing Machine": true,
          "Storage & Purified Tanks": true,
          "Water Treatment & Filtration System": true,
          "Packaging & Bagging Area": true,
          "Floor & Walls": true,
          "Drainage & Waste Disposal": true,
          "Staff Handwashing & Personal Hygiene": true,
          "Cleaning Chemical Dilution & Safety": true,
        },
        notes: "Adumasa factory clean & disinfected prior to morning dispatch",
      }),
    });

    assert.equal(res.status, 201, "Sanitation log should be saved");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.cleaningRecord.completed, true);
  });

  let drinkingSpotCustomerId: string;
  test("Step 6: Customer Registration - Bomfa Drinking Spot", async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessName: "Akoma Drinking Spot",
        contactPerson: "Kwame Mensah",
        customerType: "DRINKING_SPOT",
        phone: "+233501234567",
        community: "Bomfa",
        creditLimit: 1000.0,
        creditTermsDays: 7,
      }),
    });

    assert.equal(res.status, 201, "Customer should be created");
    const body = await res.json();
    assert.equal(body.success, true);
    drinkingSpotCustomerId = body.data.customer.id;
  });

  test("Step 7: Deliveries - 60 Bags Loaded onto Aboboyaa for Bomfa & Peminase Route", async () => {
    const res = await fetch(`${baseUrl}/api/v1/deliveries`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: drinkingSpotCustomerId,
        bagsAssigned: 60,
        notes: "Aboboyaa morning dispatch to Bomfa & Peminase",
      }),
    });

    assert.equal(res.status, 201, "Delivery should be created");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.delivery.bagsAssigned, 60);
  });

  test("Step 8: Fast Sales - Walk-In Cash Sale (10 bags @ GH₵7.00 = GH₵70.00 Cash)", async () => {
    // Look up walk-in customer and product
    const custRes = await fetch(`${baseUrl}/api/v1/customers?customerType=WALK_IN`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const custBody = await custRes.json();
    const walkInCustomer = custBody.data.customers[0];

    const prodRes = await fetch(`${baseUrl}/api/v1/products`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const prodBody = await prodRes.json();
    const waterProduct = prodBody.data.products[0];

    const res = await fetch(`${baseUrl}/api/v1/sales`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: walkInCustomer.id,
        items: [
          {
            productId: waterProduct.id,
            quantity: 10,
            unitPrice: 7.0,
          },
        ],
        amountReceived: 70.0,
        paymentMethod: "CASH",
        notes: "Factory gate walk-in sale",
      }),
    });

    assert.equal(res.status, 201, "Sale should be created");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.sale.totalAmount, 70.0);
    assert.equal(body.data.sale.amountReceived, 70.0);
    assert.equal(body.data.sale.creditAmount, 0.0);
    assert.equal(body.data.sale.status, "COMPLETED");
  });

  test("Step 9: Credit Sale - Drinking Spot Buys 50 Bags on Credit (GH₵350.00 Due)", async () => {
    const prodRes = await fetch(`${baseUrl}/api/v1/products`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const prodBody = await prodRes.json();
    const waterProduct = prodBody.data.products[0];

    const res = await fetch(`${baseUrl}/api/v1/sales`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: drinkingSpotCustomerId,
        items: [
          {
            productId: waterProduct.id,
            quantity: 50,
            unitPrice: 7.0,
          },
        ],
        amountReceived: 0.0,
        paymentMethod: "CREDIT",
        notes: "Supply on 7-day credit agreement",
      }),
    });

    assert.equal(res.status, 201, "Credit sale should be created");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.sale.totalAmount, 350.0);
    assert.equal(body.data.sale.amountReceived, 0.0);
    assert.equal(body.data.sale.creditAmount, 350.0);
    assert.equal(body.data.sale.status, "COMPLETED");

    // Verify customer outstanding balance updated to GH₵350.00
    const custRes = await fetch(`${baseUrl}/api/v1/customers/${drinkingSpotCustomerId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const custBody = await custRes.json();
    assert.equal(custBody.data.customer.currentBalance, 350.0);
  });

  test("Step 10: Credit Settlement - Customer Pays GH₵200.00 via MoMo", async () => {
    const res = await fetch(`${baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: drinkingSpotCustomerId,
        amount: 200.0,
        paymentMethod: "MOMO",
        paymentType: "CREDIT_SETTLEMENT",
        referenceNumber: "MTN-MOMO-20260916-001",
        notes: "Kwame Mensah partial settlement via MTN Mobile Money",
      }),
    });

    assert.equal(res.status, 201, "Payment recorded");
    const body = await res.json();
    assert.equal(body.success, true);

    // Verify remaining balance is 350 - 200 = 150
    const custRes = await fetch(`${baseUrl}/api/v1/customers/${drinkingSpotCustomerId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const custBody = await custRes.json();
    assert.equal(custBody.data.customer.currentBalance, 150.0);
  });

  test("Step 11: Fleet Expense - Aboboyaa Fuel (GH₵50.00 Cash)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/expenses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category: "FUEL_PETROL",
        description: "Petrol for Aboboyaa tricycle - Bomfa route",
        payee: "Goil Adumasa Filling Station",
        amount: 50.0,
        paymentMethod: "CASH",
        receiptNumber: "GOIL-REC-8841",
        notes: "Logged by driver after morning delivery run",
      }),
    });

    assert.equal(res.status, 201, "Expense recorded");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.expense.amount, 50.0);
  });

  test("Step 12: Evening Cashbook Count & Variance Reconciliation", async () => {
    // Check cashbook state before count
    const cashbookRes = await fetch(`${baseUrl}/api/v1/finance/cashbook`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const cashbookData = await cashbookRes.json();
    const expectedCash = cashbookData.data.currentBalance;

    // Physical count matches expected cash
    const res = await fetch(`${baseUrl}/api/v1/finance/cashbook/count`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actualPhysicalCash: expectedCash,
        explanationIfDiscrepancy: "Exact match recorded at shift close",
      }),
    });

    assert.equal(res.status, 200, "Cash count recorded");
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.difference, 0.0);
  });

  test("Step 13: Real Dashboard KPI Verification (Zero Fake Data)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/dashboard/overview`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const { today, month, overall } = body.data;
    assert.ok(today.producedTotal >= 300, "Today's bags produced must be >= 300");
    assert.ok(today.productionBags >= 296, "Today's good bags must be >= 296");
    assert.ok(today.salesBags >= 60, "Today's bags sold must be >= 60 (10 cash + 50 credit)");
    assert.ok(overall.outstandingReceivables >= 150.0, "Outstanding credit must reflect at least GH₵150");
  });

  test("Step 14: Monthly Report Generation & Operating Cost/Surplus Segregation", async () => {
    const res = await fetch(`${baseUrl}/api/v1/reports/monthly-management`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const report = body.data;
    assert.ok(report.currentMonth.goodBagsProduced >= 296);
    assert.ok(report.currentMonth.totalRevenue >= 420);
    assert.ok(report.currentMonth.cashExpenses >= 50);
    assert.ok(report.reportHeader.disclaimer.includes("MANAGEMENT OPERATIONAL ESTIMATE ONLY"));
  });
});
