const API_BASE = (import.meta.env?.VITE_API_URL || "") + "/api/v1";
export interface ApiResponse<T = unknown> {
  success: boolean; data?: T; message?: string;
  error?: { code: string; message: string; errorId: string; details?: unknown };
  timestamp: string;
}
const QUEUE_KEY = "nsupure_offline_queue";
type Pending = { id?: string; userId?: string; endpoint: string; method: string; body: string; timestamp: string };
function userId(): string | undefined {
  try { return JSON.parse(localStorage.getItem("nsupure_user") || "null")?.id; } catch { return undefined; }
}
export function readOfflineQueue(): Pending[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const result: unknown = JSON.parse(raw);
  if (!Array.isArray(result)) throw new Error("Stored offline entries need review. No stored data has been removed.");
  return result;
}
export function pendingOfflineCount(): number {
  try { return readOfflineQueue().length; } catch { return 1; }
}
export async function apiRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("nsupure_token");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Only production creation currently supports safe server deduplication.
  const queueable = endpoint === "/production/runs" && options.method === "POST";
  if (queueable && !headers.has("Idempotency-Key")) headers.set("Idempotency-Key", crypto.randomUUID());
  let response: Response;
  try { response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers }); }
  catch (error) {
    if (queueable && userId() && typeof options.body === "string") {
      const id = headers.get("Idempotency-Key")!;
      const queue = readOfflineQueue();
      if (!queue.some(item => item.id === id && item.userId === userId())) {
        queue.push({ id, userId: userId(), endpoint, method: "POST", body: options.body, timestamp: new Date().toISOString() });
        // Storage failures propagate; never claim a save that did not succeed.
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      }
      throw new Error("Production saved on this device for synchronization. Server confirmation is pending; retrying this entry will not create a duplicate.");
    }
    throw new Error("Connection failed. This action has not been queued. Reconnect and check the record before retrying.");
  }
  const data: ApiResponse<T> = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes("/auth/login")) {
      localStorage.removeItem("nsupure_token"); localStorage.removeItem("nsupure_user"); window.location.href = "/login";
    }
    const details = Array.isArray(data.error?.details) ? data.error!.details.map((item: { message?: string }) => item.message).filter(Boolean).join("; ") : "";
    throw new Error(details || data.error?.message || "The request could not be saved.");
  }
  return data;
}
let syncing: Promise<number> | null = null;
export function flushOfflineQueue(): Promise<number> {
  if (syncing) return syncing;
  syncing = flush().finally(() => { syncing = null; });
  return syncing;
}
async function flush(): Promise<number> {
  let synced = 0;
  const owner = userId();
  if (!owner) throw new Error("Sign in to synchronize production.");
  for (const item of readOfflineQueue()) {
    // Preserve legacy/unowned entries; do not replay them under a new user.
    if (!item.id || item.userId !== owner || item.endpoint !== "/production/runs" || item.method !== "POST") continue;
    if (userId() !== owner) break;
    await apiRequest(item.endpoint, { method: item.method, body: item.body, headers: { "Idempotency-Key": item.id } });
    // Re-read after awaiting so entries added during synchronization are retained.
    localStorage.setItem(QUEUE_KEY, JSON.stringify(readOfflineQueue().filter(pending => !(pending.id === item.id && pending.userId === owner))));
    synced++;
  }
  if (readOfflineQueue().length) throw new Error("Some entries remain pending or require review by their original user.");
  return synced;
}
