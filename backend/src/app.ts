import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { authenticate } from "./middleware/auth.js";
import { prisma } from "./utils/prisma.js";
import { ENV } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { settingsRoutes } from "./modules/settings/settings.routes.js";
import { productRoutes } from "./modules/products/products.routes.js";
import { customerRoutes } from "./modules/customers/customers.routes.js";
import { orderRoutes } from "./modules/orders/orders.routes.js";
import { saleRoutes } from "./modules/sales/sales.routes.js";
import { paymentRoutes } from "./modules/payments/payments.routes.js";
import { deliveryRoutes } from "./modules/deliveries/deliveries.routes.js";
import { fleetRoutes } from "./modules/fleet/fleet.routes.js";
import { productionRoutes } from "./modules/production/production.routes.js";
import { qualityRoutes } from "./modules/quality/quality.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { financeRoutes } from "./modules/finance/finance.routes.js";
import { staffRoutes } from "./modules/staff/staff.routes.js";
import { assetRoutes } from "./modules/assets/assets.routes.js";
import { documentRoutes } from "./modules/documents/documents.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { reportRoutes } from "./modules/reports/reports.routes.js";
import { searchRoutes } from "./modules/search/search.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { mobileSyncRoutes } from "./modules/mobile-sync/mobile-sync.routes.js";

export const app = express();
// Render terminates TLS at its reverse proxy. Do not trust arbitrary forwarding chains.
if (process.env.RENDER === "true") app.set("trust proxy", 1);

// Security HTTP Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible integration in enterprise intranet
    crossOriginEmbedderPolicy: false,
  })
);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin(origin, callback) {
      const allowed = (process.env.CORS_ORIGINS || ENV.FRONTEND_URL).split(",").map(value => value.trim());
      callback(null, !origin || allowed.includes(origin));
    },
    credentials: true,
  })
);

// Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static Document & Receipt Storage
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
app.use("/uploads", authenticate, express.static(path.resolve(uploadDir)));

// Readiness checks persistent storage without exposing its configuration.
app.get("/ready", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: "ready" }); }
  catch { res.status(503).json({ status: "unavailable" }); }
});

// System Health Probe
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "NSUPURE MINERAL WATER ENTERPRISE - Operational Backbone API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Mount All Domain Modules under /api/v1 and /api
const mountRoutes = (prefix: string) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/settings`, settingsRoutes);
  app.use(`${prefix}/products`, productRoutes);
  app.use(`${prefix}/customers`, customerRoutes);
  app.use(`${prefix}/orders`, orderRoutes);
  app.use(`${prefix}/sales`, saleRoutes);
  app.use(`${prefix}/payments`, paymentRoutes);
  app.use(`${prefix}/deliveries`, deliveryRoutes);
  app.use(`${prefix}/fleet`, fleetRoutes);
  app.use(`${prefix}/production`, productionRoutes);
  app.use(`${prefix}/quality`, qualityRoutes);
  app.use(`${prefix}/inventory`, inventoryRoutes);
  app.use(`${prefix}/finance`, financeRoutes);
  app.use(`${prefix}/staff`, staffRoutes);
  app.use(`${prefix}/assets`, assetRoutes);
  app.use(`${prefix}/documents`, documentRoutes);
  app.use(`${prefix}/dashboard`, dashboardRoutes);
  app.use(`${prefix}/reports`, reportRoutes);
  app.use(`${prefix}/search`, searchRoutes);
  app.use(`${prefix}/audit`, auditRoutes);
  app.use(`${prefix}/mobile-sync`, mobileSyncRoutes);
};

mountRoutes("/api/v1");
mountRoutes("/api");

import fs from "fs";

// Production Static Serving for Single-Service Cloud Deployments
const candidateDistPaths = [
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(process.cwd(), "../frontend/dist"),
  typeof __dirname !== "undefined" ? path.resolve(__dirname, "../../frontend/dist") : "",
].filter(Boolean);

const frontendDist = candidateDistPaths.find((p) => fs.existsSync(p));
if (frontendDist) {
  console.log(`[Fullstack Production] Serving compiled frontend SPA from: ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path === "/health") {
      return next();
    }
    res.sendFile(path.resolve(frontendDist, "index.html"));
  });
}

// Centralized Error Handler (Friendly messages, Error IDs, no exposed stack traces)
app.use(errorHandler);
