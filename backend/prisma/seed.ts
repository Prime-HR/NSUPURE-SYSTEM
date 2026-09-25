import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BUSINESS_INFO, SYSTEM_ROLES } from "../src/config/constants.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Nsupure initial system defaults...");

  // 1. Seed System Roles
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
  console.log("System roles created:", Object.keys(createdRoles).length);

  // 2. Seed Initial Owner Account (Customizable via environment variables)
  const defaultOwnerUsername = (process.env.INITIAL_OWNER_USERNAME || "owner").toLowerCase();
  const defaultPassword = process.env.INITIAL_OWNER_PASSWORD || "Nsupure2025!";
  const defaultEmail = process.env.INITIAL_OWNER_EMAIL || "owner@nsupure.com";
  const defaultFullName = process.env.INITIAL_OWNER_NAME || "Nsupure Managing Proprietor";
  const existingOwner = await prisma.user.findUnique({ where: { username: defaultOwnerUsername } });
  if (!existingOwner && process.env.NODE_ENV === "production" && (!process.env.INITIAL_OWNER_PASSWORD || defaultPassword === "Nsupure2025!")) {
    throw new Error("Set a unique INITIAL_OWNER_PASSWORD before initializing production.");
  }
  const passwordHash = existingOwner?.passwordHash || await bcrypt.hash(defaultPassword, 12);

  const ownerUser = await prisma.user.upsert({
    where: { username: defaultOwnerUsername },
    update: {}, // Never overwrite an existing owner during initialization.
    create: {
      username: defaultOwnerUsername,
      email: defaultEmail,
      fullName: defaultFullName,
      phone: "+233000000000",
      passwordHash,
      status: "ACTIVE",
    },
  });

  // Assign OWNER role to owner user
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
  console.log(`Default owner account configured: ${defaultOwnerUsername}`);

  // 3. Seed Default Product (Section 67)
  const defaultProduct = await prisma.product.upsert({
    where: { code: "NSP-500ML" },
    update: {},
    create: {
      code: "NSP-500ML",
      name: "Nsupure 500ml Sachet Drinking Water",
      unit: "BAG",
      sachetsPerBag: BUSINESS_INFO.sachetsPerBag, // 30
      defaultPrice: BUSINESS_INFO.defaultPricePerBag, // GH₵7.00
      isActive: true,
    },
  });

  // Record initial price history
  await prisma.productPrice.create({
    data: {
      productId: defaultProduct.id,
      price: BUSINESS_INFO.defaultPricePerBag,
      changedBy: "SYSTEM_INIT",
      changeReason: "Initial enterprise default price established Dec 2025",
    },
  });
  console.log(`Default product created: ${defaultProduct.name} (GH₵${defaultProduct.defaultPrice}/bag)`);

  // 4. Seed Default Customer: WALK-IN CUSTOMER (Section 67)
  const walkinCustomer = await prisma.customer.upsert({
    where: { customerCode: "CUST-WALKIN" },
    update: {},
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
  console.log(`Default customer created: ${walkinCustomer.businessName}`);

  // 5. Seed Core Business Settings
  const coreSettings = [
    { key: "company_name", value: BUSINESS_INFO.name, category: "COMPANY", desc: "Registered business name" },
    { key: "factory_location", value: BUSINESS_INFO.factoryLocation, category: "FACTORY", desc: "Factory community and region" },
    { key: "production_start_date", value: BUSINESS_INFO.productionStartDate, category: "COMPANY", desc: "Start date of operations" },
    { key: "purified_water_tank_litres", value: String(BUSINESS_INFO.purifiedWaterTankLitres), category: "FACTORY", desc: "Purified water storage capacity in litres" },
    { key: "raw_water_tank_litres", value: "2000", category: "FACTORY", desc: "Raw water storage capacity (configurable by administrator)" },
    { key: "default_price_per_bag", value: String(BUSINESS_INFO.defaultPricePerBag), category: "PRODUCTION", desc: "Current standard selling price per bag (GHS)" },
    { key: "currency", value: BUSINESS_INFO.currency, category: "FINANCE", desc: "Operating currency" },
    { key: "initial_debt_amount", value: String(BUSINESS_INFO.initialKnownDebtPendingConfirmation), category: "FINANCE", desc: "Initial business liability pending confirmation (GHS 30,000)" },
  ];

  for (const s of coreSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {}, // Preserve settings changed by management.
      create: {
        key: s.key,
        value: s.value,
        category: s.category,
        description: s.desc,
        updatedBy: "SYSTEM_INIT",
      },
    });
  }
  console.log("Core enterprise settings initialized.");

  // 6. Seed Initial Operational Assets (Equipment - Section 4)
  const initialAssets = [
    { code: "AST-BHR-01", name: "Borehole Water Source", category: "LAND", condition: "GOOD", notes: "Primary deep groundwater source at Adumasa" },
    { code: "AST-TRT-01", name: "Water Treatment & Filtration System", category: "TREATMENT_PLANT", condition: "GOOD", notes: "Includes resin, active carbon, and quartz sand filtration columns" },
    { code: "AST-TNK-01", name: "Purified Water Storage Tank (1,000L)", category: "STORAGE_TANKS", condition: "GOOD", notes: "Food-grade stainless/poly purified storage" },
    { code: "AST-TNK-02", name: "Raw Water Storage Tank", category: "STORAGE_TANKS", condition: "GOOD", notes: "Raw water equalization tank" },
    { code: "AST-SCH-01", name: "Automatic Sachet Filling & Sealing Machine", category: "SACHET_MACHINE", condition: "GOOD", notes: "Forms, fills and heat-seals 500ml sachets" },
    { code: "AST-GEN-01", name: "Diesel Backup Generator", category: "GENERATOR", condition: "GOOD", notes: "Backup power for continuous factory operations" },
    { code: "AST-FLT-01", name: "Aboboyaa Motorized Tricycle", category: "VEHICLE", condition: "GOOD", notes: "Primary local distribution vehicle (~60 bags/trip capacity)" },
  ];

  for (const asset of initialAssets) {
    await prisma.asset.upsert({
      where: { assetCode: asset.code },
      update: {},
      create: {
        assetCode: asset.code,
        name: asset.name,
        category: asset.category,
        condition: asset.condition,
        location: "Adumasa Factory",
        isProfessionallyAppraised: false,
        notes: asset.notes,
      },
    });
  }
  console.log("Primary factory equipment assets registered.");

  // 7. Seed Initial Primary Delivery Vehicle: Aboboyaa Tricycle
  await prisma.vehicle.upsert({
    where: { registrationNumber: "ABOBOYAA-01" },
    update: {},
    create: {
      registrationNumber: "ABOBOYAA-01",
      vehicleType: "ABOBOYAA_TRICYCLE",
      makeModel: "Motorized Tricycle (60 bags capacity)",
      status: "ACTIVE",
      currentOdometer: 0.0,
      serviceIntervalKm: 1500.0,
    },
  });

  // 8. Seed Core Target Delivery Routes (Section 24)
  const initialRoutes = [
    { code: "RT-BOMFA", name: "Bomfa - Peminase Route", communities: "Bomfa, Peminase" },
    { code: "RT-AKWUWIE", name: "Akwuwie - Wabier Route", communities: "Akwuwie, Wabier" },
    { code: "RT-BEPOSO", name: "Beposo - Achiase Route", communities: "Beposo, Achiase" },
  ];

  for (const rt of initialRoutes) {
    await prisma.route.upsert({
      where: { code: rt.code },
      update: {},
      create: {
        code: rt.code,
        name: rt.name,
        targetCommunities: rt.communities,
        isActive: true,
      },
    });
  }

  // 9. Seed Default Cash Account: Factory Cash Safe / Till
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
  }

  // 10. Seed Initial Standard Inventory Items (Section 27)
  const standardItems = [
    { code: "INV-FLM-01", name: "500ml Sachet Film Rolls", category: "SACHET_FILM", unit: "ROLL", reorder: 5.0 },
    { code: "INV-BAG-01", name: "Outer Packaging Bags (30s)", category: "OUTER_BAGS", unit: "BUNDLE", reorder: 10.0 },
    { code: "INV-CHM-01", name: "Water Treatment Conditioning Chemicals", category: "CHEMICALS", unit: "KG", reorder: 5.0 },
    { code: "INV-FLT-01", name: "Micron Sediment Filters (10 inch)", category: "FILTERS", unit: "PIECE", reorder: 4.0 },
    { code: "INV-CLN-01", name: "Food Grade Sanitizer & Detergent", category: "CLEANING", unit: "LITRE", reorder: 5.0 },
    { code: "INV-PET-01", name: "Petrol (Aboboyaa Fuel)", category: "FUEL", unit: "LITRE", reorder: 15.0 },
  ];

  for (const item of standardItems) {
    await prisma.inventoryItem.upsert({
      where: { itemCode: item.code },
      update: {},
      create: {
        itemCode: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        reorderLevel: item.reorder,
        openingStock: 0.0,
        currentStock: 0.0,
      },
    });
  }

  console.log("Safe initial system seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during database seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
