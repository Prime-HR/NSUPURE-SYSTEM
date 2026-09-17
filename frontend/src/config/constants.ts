export const BUSINESS_INFO = {
  name: "NSUPURE MINERAL WATER ENTERPRISE",
  legalType: "Sole Proprietorship",
  industry: "Sachet Drinking-Water Manufacturing and Distribution",
  factoryLocation: "Adumasa, Juaben Constituency, Ashanti Region, Ghana",
  productionStartDate: "2025-12-21",
  mainProduct: "500ml Sachet Drinking Water",
  sachetsPerBag: 30,
  defaultPricePerBag: 7.0, // GHS
  currency: "GHS",
  purifiedWaterTankLitres: 1000,
  rawWaterTankLitresConfigurable: true,
  currentDefaultDeliveryVehicle: "Aboboyaa (Motorized Tricycle)",
  vehicleCapacityBags: 60,
  defaultEmployeeMonthlySalary: 1000.0, // GHS
  initialKnownDebtPendingConfirmation: 30000.0, // GHS
  targetCommunities: [
    "Bomfa",
    "Peminase",
    "Akwuwie",
    "Wabier",
    "Beposo",
    "Achiase",
  ],
  workingHours: {
    morningShift: "8:00 AM - 12:00 PM",
    afternoonShift: "1:00 PM - 5:00 PM",
    daysPerWeek: 6,
  },
} as const;

export const SYSTEM_ROLES = [
  "OWNER",
  "ADMINISTRATOR",
  "MANAGER",
  "PRODUCTION_SUPERVISOR",
  "SALES",
  "DRIVER",
  "FINANCE",
  "INVENTORY",
  "VIEWER",
] as const;

export const CUSTOMER_TYPES = [
  "WALK_IN",
  "DRINKING_SPOT",
  "CHOP_BAR",
  "SCHOOL",
  "OFFICE",
  "BUSINESS",
  "SHOP",
  "WHOLESALER",
  "DISTRIBUTOR",
  "INDIVIDUAL",
  "OTHER",
] as const;

export const PAYMENT_METHODS = ["CASH", "MOMO", "BANK", "OTHER"] as const;

export const SANITATION_AREAS = [
  "Production Room",
  "Filling & Sealing Machine",
  "Storage & Purified Tanks",
  "Water Treatment & Filtration System",
  "Packaging & Bagging Area",
  "Floor & Walls",
  "Drainage & Waste Disposal",
  "Staff Handwashing & Personal Hygiene",
  "Cleaning Chemical Dilution & Safety",
] as const;
