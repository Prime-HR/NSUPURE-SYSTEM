const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "nsupure-upgrade-"));
const file = path.join(temp, "legacy.db");
const schema = path.join(temp, "legacy.prisma");
const source = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const old = source.replace(/model (ProductionRun|ProductionBatch) \{[\s\S]*?\n\}/g, block => block.replace(/^.*(?:version\s+Int\s+@default\(1\)|voidedAt\s+DateTime\?|voidReason\s+String\?|requestId\s+String\?|requestHash\s+String\?).*\r?\n/gm, ""));
fs.writeFileSync(schema, old);
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: `file:${file.replace(/\\/g, "/")}`, MAINTENANCE_CONFIRMED: "WRITES_STOPPED" };
function command(exe, args, overrides = {}) {
  const result = spawnSync(exe, args, { cwd: root, env: { ...env, ...overrides }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout;
}
const sql = command(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema-datamodel", schema, "--script"]);
let db = new DatabaseSync(file); db.exec(sql);
db.exec(`INSERT INTO "Product" (id,code,name,updatedAt) VALUES ('legacy-product','LEGACY','Existing product',1000);
INSERT INTO "ProductionRun" (id,runNumber,date,shift,productId,machineHours,bagsProduced,rejectedBags,goodBags,updatedAt) VALUES ('legacy-run','RUN-ORIGINAL',1000,'MORNING_8_12','legacy-product',4,100,2,98,1000);
INSERT INTO "ProductionBatch" (id,batchNumber,productionRunId,productionDate,expiryDate,totalGoodBags,remainingBags) VALUES ('legacy-batch','BATCH-ORIGINAL','legacy-run',1000,999999,98,60);`);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
const snapshots = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all()]));
db.close();
command("python", ["scripts/backup_database.py", "--output", path.join(temp, "backups")]);
const manifest = path.join(temp, "backups", fs.readdirSync(path.join(temp, "backups")).find(name => name.endsWith(".json")));
command(process.execPath, ["scripts/upgrade-production.cjs"], { BACKUP_MANIFEST: manifest });
command(process.execPath, ["scripts/upgrade-production.cjs"], { BACKUP_MANIFEST: manifest });
db = new DatabaseSync(file);
for (const table of tables) {
  const rows = db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all();
  assert.equal(rows.length, snapshots[table].length, `${table} record count preserved`);
  snapshots[table].forEach((row, index) => { for (const [key, value] of Object.entries(row)) assert.equal(rows[index][key], value, `${table}.${key} preserved`); });
}
assert.equal(db.prepare('SELECT version FROM "ProductionRun"').get().version, 1);
assert.equal(db.prepare('SELECT voidedAt FROM "ProductionRun"').get().voidedAt, null);
db.close();
const proof = JSON.parse(fs.readFileSync(manifest, "utf8"));
const restored = path.join(temp, "restore.db"); fs.copyFileSync(proof.file, restored);
db = new DatabaseSync(restored);
for (const table of tables) assert.deepEqual(db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all(), snapshots[table]);
db.close();
proof.sha256 = "tampered"; fs.writeFileSync(manifest, JSON.stringify(proof));
assert.notEqual(spawnSync(process.execPath, ["scripts/upgrade-production.cjs"], { cwd: root, env: { ...env, BACKUP_MANIFEST: manifest }, encoding: "utf8" }).status, 0);
console.log(`PASS: ${tables.length} tables preserved, repeated upgrade safe, restore matches original records, invalid evidence blocked.`);
console.log("Disposable rehearsal retained:", temp);
