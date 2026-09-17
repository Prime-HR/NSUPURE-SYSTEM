import React, { createContext, useContext, useState, useEffect } from "react";
import { flushOfflineQueue } from "../services/api.ts";

export type NetworkStatus = "ONLINE" | "OFFLINE" | "SYNCING" | "SYNC_ERROR";

interface OfflineContextType {
  status: NetworkStatus;
  pendingCount: number;
  triggerSync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<NetworkStatus>(navigator.onLine ? "ONLINE" : "OFFLINE");
  const [pendingCount, setPendingCount] = useState<number>(() => {
    const q = localStorage.getItem("nsupure_offline_queue");
    return q ? JSON.parse(q).length : 0;
  });

  const updatePendingCount = () => {
    const q = localStorage.getItem("nsupure_offline_queue");
    setPendingCount(q ? JSON.parse(q).length : 0);
  };

  const triggerSync = async () => {
    if (!navigator.onLine) return;
    setStatus("SYNCING");
    try {
      await flushOfflineQueue();
      updatePendingCount();
      setStatus("ONLINE");
    } catch {
      setStatus("SYNC_ERROR");
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setStatus("ONLINE");
      triggerSync();
    };

    const handleOffline = () => {
      setStatus("OFFLINE");
      updatePendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ status, pendingCount, triggerSync }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
};
