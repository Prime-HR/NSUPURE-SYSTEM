// Only the disposable, local CI service is permitted. Every file gets a new schema.
const { readdirSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = resolve(__dirname, "..");
const url = new URL(process.env.DATABASE_URL || "file:invalid");
if (process.env.CI !== "true" || url.protocol !== "postgresql:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/nsupure_ci") {
  throw new Error("Requires the disposable local nsupure_ci PostgreSQL CI service.");
}
function run(args, env) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const file of readdirSync(join(root, "tests/integration")).filter(name => name.endsWith(".test.ts"))) {
  url.searchParams.set("schema", "test_" + randomUUID().replaceAll("-", ""));
  const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test", JWT_SECRET: "isolated-test-secret-not-for-production", INITIAL_OWNER_USERNAME: "owner", INITIAL_OWNER_PASSWORD: "Nsupure2025!" };
  run(["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], env);
  run(["--import", "tsx", "prisma/seed.ts"], env);
  run(["--import", "tsx", "--test", "tests/integration/" + file], env);
}
