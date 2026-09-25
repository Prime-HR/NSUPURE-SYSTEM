const { mkdtempSync, writeFileSync, readdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const root = resolve(__dirname, "..");
function run(args, env) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
const files = ["unit", "integration"].flatMap(folder => readdirSync(join(root, "tests", folder)).filter(name => name.endsWith(".test.ts")).map(name => `tests/${folder}/${name}`));
for (const file of files) {
  const temp = mkdtempSync(join(tmpdir(), "nsupure-tests-"));
  writeFileSync(join(temp, "test.db"), "", { flag: "wx" });
  const env = { ...process.env, DATABASE_URL: `file:${join(temp, "test.db").replace(/\\/g, "/")}`, NODE_ENV: "test", JWT_SECRET: "isolated-test-secret-not-for-production", INITIAL_OWNER_USERNAME: "owner", INITIAL_OWNER_PASSWORD: "Nsupure2025!" };
  if (file.includes("integration")) {
    run(["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], env);
    run(["--import", "tsx", "prisma/seed.ts"], env);
  }
  run(["--import", "tsx", "--test", file], env);
  console.log("Disposable test database retained for inspection:", temp);
}
