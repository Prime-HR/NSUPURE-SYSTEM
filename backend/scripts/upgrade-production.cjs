// Reviewed additive upgrade only. No drops, truncation, seeding, or db push.
require("dotenv").config();
const fs = require("node:fs");
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
async function main() {
  const url = process.env.DATABASE_URL || "";
  const manifestPath = process.env.BACKUP_MANIFEST;
  if (!manifestPath) throw new Error("BACKUP_MANIFEST is required. Back up and rehearse restoration first.");
  const proof = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (proof.databaseFingerprint !== hash(url) || proof.sha256 !== hash(fs.readFileSync(proof.file))) throw new Error("Backup does not match this database configuration or its checksum changed.");
  const age = Date.now() - Date.parse(proof.createdAt);
  if (!Number.isFinite(age) || age < 0 || age > 86400000 || proof.restoreVerified !== true) throw new Error("A restore-verified backup less than 24 hours old is required.");
  if (process.env.MAINTENANCE_CONFIRMED !== "WRITES_STOPPED") throw new Error("Stop all application writers and set MAINTENANCE_CONFIRMED=WRITES_STOPPED.");
  const pg = /^postgres(ql)?:/.test(url);
  if (!pg && !url.startsWith("file:")) throw new Error("Unsupported database provider.");
  await prisma.$transaction(async tx => {
    if (pg) await tx.$executeRawUnsafe('LOCK TABLE "ProductionRun", "ProductionBatch" IN ACCESS EXCLUSIVE MODE');
    const specs = {
      ProductionRun: { requestId: "TEXT", requestHash: "TEXT", version: "INTEGER NOT NULL DEFAULT 1", voidedAt: pg ? "TIMESTAMP(3)" : "DATETIME", voidReason: "TEXT" },
      ProductionBatch: { voidedAt: pg ? "TIMESTAMP(3)" : "DATETIME" },
    };
    for (const [table, columns] of Object.entries(specs)) {
      const before = await tx.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM "${table}"`);
      const info = pg
        ? await tx.$queryRawUnsafe('SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', table)
        : await tx.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
      const names = new Set(info.map(column => column.name));
      if (!names.size) throw new Error(`Existing ${table} table is required. This script does not initialize databases.`);
      for (const [column, type] of Object.entries(columns)) {
        if (!names.has(column)) await tx.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
      }
      if (table === "ProductionRun") await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ProductionRun_requestId_key" ON "ProductionRun"("requestId")');
      const after = await tx.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM "${table}"`);
      if (String(before[0].count) !== String(after[0].count)) throw new Error(`Row-count mismatch in ${table}`);
      console.log(`${table}: additive upgrade verified; ${String(after[0].count)} records preserved.`);
    }
  }, { timeout: 60000 });
}
main().catch(() => { console.error("Upgrade stopped. Verify backup evidence, maintenance mode and database schema privately; no destructive migration is performed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
