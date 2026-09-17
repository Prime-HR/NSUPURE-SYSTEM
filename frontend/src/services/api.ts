const API_BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    errorId: string;
    details?: unknown;
  };
  timestamp: string;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("nsupure_token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      // If unauthorized, clear token
      if (response.status === 401 && !endpoint.includes("/auth/login")) {
        localStorage.removeItem("nsupure_token");
        localStorage.removeItem("nsupure_user");
        window.location.href = "/login";
      }
      throw new Error(data.error?.message || "An error occurred with your request");
    }

    return data;
  } catch (err: unknown) {
    const error = err as Error;

    // Check offline status
    if (!navigator.onLine) {
      // Queue POST/PUT requests for offline replay if applicable
      if (options.method && ["POST", "PUT"].includes(options.method)) {
        queueOfflineRequest(endpoint, options);
      }
      throw new Error("You are currently offline. Actions have been queued for sync.");
    }

    throw error;
  }
}

function queueOfflineRequest(endpoint: string, options: RequestInit) {
  const queue = JSON.parse(localStorage.getItem("nsupure_offline_queue") || "[]");
  queue.push({
    endpoint,
    method: options.method,
    body: options.body,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem("nsupure_offline_queue", JSON.stringify(queue));
}

export async function flushOfflineQueue(): Promise<number> {
  const queue = JSON.parse(localStorage.getItem("nsupure_offline_queue") || "[]");
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      await apiRequest(item.endpoint, {
        method: item.method,
        body: item.body,
      });
      synced++;
    } catch {
      remaining.push(item);
    }
  }

  localStorage.setItem("nsupure_offline_queue", JSON.stringify(remaining));
  return synced;
}
