import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { app } from "../src/app.js";

test("authenticated mobile events are deduplicated and can be pulled", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  try {
    const login = await fetch(`${base}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:"owner",password:"Nsupure2025!"}) });
    assert.equal(login.status, 200);
    const token = (await login.json() as { data:{token:string} }).data.token;
    const event = { eventId:"mobile-test-event-0001", entity:"productions", entityId:"production-test-1", action:"CREATE", payload:{id:"production-test-1",bags:12,updatedAt:Date.now()}, occurredAt:new Date().toISOString() };
    const push = () => fetch(`${base}/mobile-sync/events`, { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({deviceId:"mobile-test-device-0001",events:[event]}) });
    assert.equal((await push()).status, 202);
    assert.equal((await push()).status, 202, "A retry is accepted without duplicating the event");
    const pull = await fetch(`${base}/mobile-sync/events`, { headers:{Authorization:`Bearer ${token}`} });
    const data = await pull.json() as { data:{events:Array<{payload:{bags:number}}>} };
    assert.equal(pull.status, 200);
    assert.equal(data.data.events.filter(item => item.payload.bags === 12).length, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
