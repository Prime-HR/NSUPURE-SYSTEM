import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BUSINESS_INFO, SYSTEM_ROLES } from "../config/constants.js";

const prisma = new PrismaClient();

export async function cleanDatabase() {
  console.log("=================================================");
  console.log("  NSUPURE SYSTEM: CLEANING TEST/TRANSACTION DATA ");
  console.log("=================================================");

  // 1. Sales, Payments, Orders
  console.log("1. Removing sales, payments & orders...");
  await prisma.saleItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  // 2. Deliveries & Fleet
  console.log("2. Removing deliveries, trips & fleet maintenance...");
  await prisma.deliveryItem.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.vehicleTrip.deleteMany();
  await prisma.vehicleFuel.deleteMany();
  await prisma.vehicleMaintenance.deleteMany();

  // 3. Production, Batches, Quality, Waste & Sanitation
  console.log("3. Removing production, batches, quality checks & waste...");
  await prisma.productionQualityCheck.deleteMany();
  await prisma.qualityTest.deleteMany();
  await prisma.cleaningRecord.deleteMany();
  await prisma.productionWaste.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.productionBatch.deleteMany();
  await prisma.productionRun.deleteMany();

  // 4. Inventory Transactions & Purchases
  console.log("4. Removing inventory transactions & purchase orders...");
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.inventoryTransaction.deleteMany();

  // 5. Finance: Cash, Bank, MoMo & Expenses
  console.log("5. Removing cashbook transactions, bank/momo logs & expenses...");
  await prisma.cashTransaction.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.momoTransaction.deleteMany();
  await prisma.expense.deleteMany();

  // 6. Loans & Payments
  console.log("6. Removing loan payment records...");
  await prisma.loanPayment.deleteMany();

  // 7. Staff: Attendance, Payroll & Employees
  console.log("7. Removing payroll, attendance & staff records...");
  await prisma.payroll.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.employee.deleteMany();

  // 8. Customers (Keep factory walk-in customer)
  console.log("8. Removing test customers (preserving WALK-IN CUSTOMER)...");
  await prisma.customer.deleteMany({
    where: {
      customerCode: { not: "CUST-WALKIN" },
    },
  });

  // 9. Assets Maintenance, Docs, Notifications & Audit Logs
  console.log("9. Removing asset maintenance, docs, notifications & audit logs...");
  await prisma.assetMaintenance.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();

  // 10. Reset cash account balance to 0.0
  console.log("10. Resetting cash safe balances to GH₵0.00...");
  await prisma.cashAccount.updateMany({
    data: { currentBalance: 0.0 },
  });

  // 11. Reset inventory stock levels to 0.0
  console.log("11. Resetting inventory items to 0.0 stock...");
  await prisma.inventoryItem.updateMany({
    data: { openingStock: 0.0, currentStock: 0.0 },
  });

  // 12. Reset vehicle odometers to 0.0
  console.log("12. Resetting vehicle odometers to 0.0 km...");
  await prisma.vehicle.updateMany({
    data: { currentOdometer: 0.0 },
  });

  // 13. Remove test user accounts (preserving root owner)
  console.log("13. Removing test user accounts (preserving root owner)...");
  const nonOwnerUsers = await prisma.user.findMany({
    where: { username: { not: "owner" } },
    select: { id: true },
  });
  for (const u of nonOwnerUsers) {
    await prisma.userRole.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }

  // 14. Re-verify foundational defaults
  console.log("14. Re-verifying pristine system foundational defaults...");
  
  // System Roles
  const createdRoles: Record<string, string> = {};
  for (const roleCode of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: {},
      create: {
        code: roleCode,
        name: roleCode.replace(/_/g, " "),
        description: `System role for ${roleCode.replace(/_/g, " ")}`,
        isSystem: true,
      },
    });
    createdRoles[roleCode] = role.id;
  }

  // Primary Owner
  const defaultPassword = process.env.INITIAL_OWNER_PASSWORD || "Nsupure2025!";
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  const ownerUser = await prisma.user.upsert({
    where: { username: "owner" },
    update: { passwordHash, status: "ACTIVE" },
    create: {
      username: "owner",
      email: "owner@nsupure.com",
      fullName: "Nsupure Managing Proprietor",
      phone: "+233000000000",
      passwordHash,
      status: "ACTIVE",
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: ownerUser.id,
        roleId: createdRoles["OWNER"],
      },
    },
    update: {},
    create: {
      userId: ownerUser.id,
      roleId: createdRoles["OWNER"],
    },
  });

  // Default Product (500ml Sachet Water)
  await prisma.product.upsert({
    where: { code: "NSP-500ML" },
    update: {
      sachetsPerBag: BUSINESS_INFO.sachetsPerBag,
      defaultPrice: BUSINESS_INFO.defaultPricePerBag,
      isActive: true,
    },
    create: {
      code: "NSP-500ML",
      name: "Nsupure 500ml Sachet Drinking Water",
      unit: "BAG",
      sachetsPerBag: BUSINESS_INFO.sachetsPerBag,
      defaultPrice: BUSINESS_INFO.defaultPricePerBag,
      isActive: true,
    },
  });

  // Default Walk-In Customer
  await prisma.customer.upsert({
    where: { customerCode: "CUST-WALKIN" },
    update: { currentBalance: 0.0, status: "ACTIVE" },
    create: {
      customerCode: "CUST-WALKIN",
      businessName: "WALK-IN CUSTOMER",
      contactPerson: "Factory Walk-in Buyer",
      customerType: "WALK_IN",
      community: "Adumasa",
      address: "Nsupure Factory Gate",
      creditLimit: 0.0,
      creditTermsDays: 0,
      currentBalance: 0.0,
      status: "ACTIVE",
      notes: "Default system customer for immediate cash purchases at factory gate",
    },
  });

  // Primary Cash Safe Account
  const existingCashAccount = await prisma.cashAccount.findFirst({
    where: { name: "Factory Cash Safe / Till" },
  });
  if (!existingCashAccount) {
    await prisma.cashAccount.create({
      data: {
        name: "Factory Cash Safe / Till",
        currency: "GHS",
        currentBalance: 0.0,
        isActive: true,
      },
    });
  } else {
    await prisma.cashAccount.update({
      where: { id: existingCashAccount.id },
      data: { currentBalance: 0.0 },
    });
  }

  console.log("=================================================");
  console.log("  DATABASE CLEANING COMPLETE: PRISTINE STATE!     ");
  console.log("=================================================");
}

cleanDatabase()
  .catch((e) => {
    console.error("Error cleaning database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
