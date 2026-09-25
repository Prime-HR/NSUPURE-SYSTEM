import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { prisma } from "../../src/utils/prisma.js";

test("initialization preserves owner/settings; password reset revokes sessions; uploads and CORS are protected", async () => {
  assert.equal(process.env.NODE_ENV, "test");
  const password = "isolated-new-owner-password";
  const passwordHash = await bcrypt.hash(password, 12);
  const owner = await prisma.user.update({ where: { username: "owner" }, data: { passwordHash, fullName: "Existing owner name", email: "existing-owner@test.invalid" } });
  await prisma.setting.update({ where: { key: "default_price_per_bag" }, data: { value: "9.50" } });
  const before = { users: await prisma.user.count(), customers: await prisma.customer.count(), products: await prisma.product.count() };
  const seed = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: process.env, encoding: "utf8" });
  assert.equal(seed.status, 0, seed.stderr);
  const after = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
  assert.equal(after.passwordHash, passwordHash); assert.equal(after.fullName, owner.fullName); assert.equal(after.email, owner.email);
  assert.equal((await prisma.setting.findUniqueOrThrow({ where: { key: "default_price_per_bag" } })).value, "9.50");
  assert.deepEqual({ users: await prisma.user.count(), customers: await prisma.customer.count(), products: await prisma.product.count() }, before);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const login = await fetch(base + "/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "owner", password }) });
    const token = (await login.json()).data.token;
    const reset = await fetch(base + "/api/v1/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword: password, newPassword: "another-isolated-test-password" }) });
    assert.equal(reset.status, 200);
    assert.equal((await fetch(base + "/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } })).status, 401);
    assert.equal((await fetch(base + "/uploads/private-file.pdf")).status, 401);
    assert.equal((await fetch(base + "/health", { headers: { Origin: "https://untrusted.test" } })).headers.get("access-control-allow-origin"), null);
    assert.equal((await fetch(base + "/health", { headers: { Origin: "http://localhost:3000" } })).headers.get("access-control-allow-origin"), "http://localhost:3000");
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); }
});
