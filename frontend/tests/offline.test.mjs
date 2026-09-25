import { test } from "node:test";
import assert from "node:assert/strict";
import { apiRequest, flushOfflineQueue } from "../src/services/api.ts";
class Storage {
  values = new Map(); getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); } removeItem(key) { this.values.delete(key); }
}
function setup() {
  globalThis.localStorage = new Storage();
  localStorage.setItem("nsupure_user", JSON.stringify({ id: "owner-a" }));
  localStorage.setItem("nsupure_token", "test-token");
}
test("offline production retries deduplicate and sync preserves concurrently added entries", async () => {
  setup(); globalThis.fetch = async () => { throw new TypeError("network unavailable"); };
  const options = { method: "POST", body: JSON.stringify({ bagsProduced: 12 }), headers: { "Idempotency-Key": "fixed-id" } };
  await assert.rejects(apiRequest("/production/runs", options), /saved on this device/);
  await assert.rejects(apiRequest("/production/runs", options));
  assert.equal(JSON.parse(localStorage.getItem("nsupure_offline_queue")).length, 1);
  globalThis.fetch = async () => {
    const queue = JSON.parse(localStorage.getItem("nsupure_offline_queue"));
    queue.push({ id: "new-id", userId: "owner-a", endpoint: "/production/runs", method: "POST", body: "{}" });
    localStorage.setItem("nsupure_offline_queue", JSON.stringify(queue));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  await assert.rejects(flushOfflineQueue(), /remain pending/);
  assert.deepEqual(JSON.parse(localStorage.getItem("nsupure_offline_queue")).map(row => row.id), ["new-id"]);
});
test("another user's entries and legacy queue entries are retained without replay", async () => {
  setup(); const queue = [{ endpoint: "/sales", method: "POST", body: "{}" }, { id: "other", userId: "owner-b", endpoint: "/production/runs", method: "POST", body: "{}" }];
  localStorage.setItem("nsupure_offline_queue", JSON.stringify(queue));
  globalThis.fetch = async () => { assert.fail("Must not replay legacy or other-user entries"); };
  await assert.rejects(flushOfflineQueue());
  assert.deepEqual(JSON.parse(localStorage.getItem("nsupure_offline_queue")), queue);
});
test("password changes are never stored in the offline queue", async () => {
  setup(); globalThis.fetch = async () => { throw new TypeError("offline"); };
  await assert.rejects(apiRequest("/auth/change-password", { method: "POST", body: "private-test-value" }), /has not been queued/);
  assert.equal(localStorage.getItem("nsupure_offline_queue"), null);
});
