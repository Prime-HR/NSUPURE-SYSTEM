import React, { useState, useEffect } from "react";
import { Package, Clock, Plus, CheckCircle, RefreshCw } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  balanceDue: number;
  customer: { businessName: string; community: string | null };
  items: Array<{ quantity: number; unitPrice: number; product: { name: string } }>;
}

interface RecurringOrder {
  id: string;
  quantity: number;
  frequency: string;
  unitPrice: number;
  isActive: boolean;
  customer: { businessName: string; community: string | null };
}

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recurring, setRecurring] = useState<RecurringOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrdersData = async () => {
    try {
      setLoading(true);
      const [ordRes, recRes] = await Promise.all([
        apiRequest<{ orders: Order[] }>("/orders"),
        apiRequest<{ recurringOrders: RecurringOrder[] }>("/orders/recurring"),
      ]);
      if (ordRes.data) setOrders(ordRes.data.orders);
      if (recRes.data) setRecurring(recRes.data.recurringOrders);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersData();
  }, []);

  const handleGenerateFromRecurring = async (id: string) => {
    try {
      await apiRequest(`/orders/recurring/${id}/generate`, { method: "POST" });
      fetchOrdersData();
    } catch (err) {
      alert((err as Error).message || "Failed to generate planned order");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-sky-600" />
            Orders & Recurring Supply
          </h2>
          <p className="text-xs text-slate-500">
            Customer order management and planned recurring supply cycles (e.g. 240 bags/cycle)
          </p>
        </div>
      </div>

      {/* Recurring Supply Schedules Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-black text-sm text-slate-900">Active Recurring Supply Schedules</h3>
            <p className="text-[11px] text-slate-500">Generates planned orders. Actual delivery & payment recorded separately.</p>
          </div>
          <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full">
            {recurring.length} Schedules
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Customer Account</th>
                <th className="p-3">Community</th>
                <th className="p-3 text-right">Planned Bags</th>
                <th className="p-3">Frequency</th>
                <th className="p-3 text-center">Spawn Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recurring.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400">No recurring supply arrangements yet.</td>
                </tr>
              ) : (
                recurring.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-bold text-slate-900">{r.customer.businessName}</td>
                    <td className="p-3 text-slate-600">{r.customer.community || "Adumasa"}</td>
                    <td className="p-3 text-right font-black text-slate-800">{r.quantity} bags</td>
                    <td className="p-3 font-mono text-sky-700">{r.frequency}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleGenerateFromRecurring(r.id)}
                        className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1 transition"
                      >
                        <RefreshCw className="w-3 h-3" /> Create Planned Order
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-sm text-slate-900">Customer Orders</h3>
          <span className="text-xs text-slate-500 font-mono">{orders.length} orders</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3 text-right">Total Bags</th>
                <th className="p-3 text-right">Total (GH₵)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">Loading orders...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">No orders recorded yet.</td>
                </tr>
              ) : (
                orders.map((o) => {
                  const totalBags = o.items.reduce((sum, i) => sum + i.quantity, 0);
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-mono text-slate-500">{o.orderNumber}</td>
                      <td className="p-3 text-slate-600">{new Date(o.orderDate).toLocaleDateString("en-GB")}</td>
                      <td className="p-3 font-bold text-slate-900">{o.customer.businessName}</td>
                      <td className="p-3 text-right font-black text-slate-800">{totalBags}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{o.totalAmount.toFixed(2)}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          o.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {o.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
