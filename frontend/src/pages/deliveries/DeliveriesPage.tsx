import React, { useState, useEffect } from "react";
import { Truck, CheckCircle2, AlertCircle, Plus, MapPin, Clock, X, User } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface Delivery {
  id: string;
  deliveryNumber: string;
  deliveryDate: string;
  bagsAssigned: number;
  bagsDelivered: number;
  status: string;
  paymentCollected: number;
  creditCreated: number;
  customerConfirmationName: string | null;
  customer: {
    id: string;
    businessName: string;
    community: string | null;
    phone: string | null;
  };
  route: {
    name: string;
    targetCommunities: string;
  } | null;
  vehicle: {
    registrationNumber: string;
    vehicleType: string;
  } | null;
}

interface Customer {
  id: string;
  businessName: string;
  community: string | null;
}

interface Route {
  id: string;
  name: string;
}

export const DeliveriesPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // New Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [bagsAssigned, setBagsAssigned] = useState(60); // Default Aboboyaa load
  const [notes, setNotes] = useState("");

  // Confirmation Modal State
  const [confirmingDelivery, setConfirmingDelivery] = useState<Delivery | null>(null);
  const [deliveredBagsCount, setDeliveredBagsCount] = useState(0);
  const [cashCollected, setCashCollected] = useState(0);
  const [customerName, setCustomerName] = useState("");

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const [delRes, custRes, routeRes] = await Promise.all([
        apiRequest<{ deliveries: Delivery[] }>("/deliveries"),
        apiRequest<{ customers: Customer[] }>("/customers"),
        apiRequest<{ routes: Route[] }>("/deliveries/routes"),
      ]);

      if (delRes.data) setDeliveries(delRes.data.deliveries);
      if (custRes.data) setCustomers(custRes.data.customers);
      if (routeRes.data) setRoutes(routeRes.data.routes);
    } catch (err) {
      console.error("Failed to load deliveries", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/deliveries", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomerId,
          routeId: selectedRouteId || undefined,
          bagsAssigned,
          notes,
        }),
      });
      setShowDispatchModal(false);
      fetchDeliveries();
    } catch (err) {
      alert((err as Error).message || "Failed to schedule delivery");
    }
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingDelivery) return;

    try {
      await apiRequest(`/deliveries/${confirmingDelivery.id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: "DELIVERED",
          bagsDelivered: deliveredBagsCount,
          paymentCollected: cashCollected,
          creditCreated: Math.max(0, deliveredBagsCount * 7.0 - cashCollected),
          customerConfirmationName: customerName,
        }),
      });
      setConfirmingDelivery(null);
      fetchDeliveries();
    } catch (err) {
      alert((err as Error).message || "Failed to confirm delivery");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-teal-600" />
            Deliveries & Distribution Routes
          </h2>
          <p className="text-xs text-slate-500">
            Aboboyaa motorized tricycle trips & customer delivery sheets
          </p>
        </div>
        <button
          onClick={() => setShowDispatchModal(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Schedule Dispatch
        </button>
      </div>

      {/* Delivery Trips Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Delivery ID</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Route / Community</th>
                <th className="p-3.5 text-right">Bags Assigned</th>
                <th className="p-3.5 text-right">Delivered</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">Loading deliveries...</td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">No deliveries scheduled.</td>
                </tr>
              ) : (
                deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-mono text-slate-500">{d.deliveryNumber}</td>
                    <td className="p-3.5 font-bold text-slate-900">{d.customer.businessName}</td>
                    <td className="p-3.5 text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {d.route?.name || d.customer.community || "Adumasa"}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-800">{d.bagsAssigned}</td>
                    <td className="p-3.5 text-right font-black text-teal-700">{d.bagsDelivered}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800"
                            : d.status === "OUT_FOR_DELIVERY"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      {d.status !== "DELIVERED" ? (
                        <button
                          onClick={() => {
                            setConfirmingDelivery(d);
                            setDeliveredBagsCount(d.bagsAssigned);
                            setCashCollected(d.bagsAssigned * 7.0);
                          }}
                          className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
                        >
                          Confirm Delivery
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CONFIRM DELIVERY MODAL                                        */}
      {/* ------------------------------------------------------------- */}
      {confirmingDelivery && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="font-black text-base text-slate-900 mb-1">Confirm Customer Delivery</h3>
            <p className="text-xs text-slate-500 mb-4">{confirmingDelivery.customer.businessName}</p>

            <form onSubmit={handleConfirmDelivery} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bags Delivered</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={deliveredBagsCount}
                  onChange={(e) => setDeliveredBagsCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cash Payment Collected (GH₵)</label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  required
                  value={cashCollected}
                  onChange={(e) => setCashCollected(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Received By (Name)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Madam Faustina, Bar Manager"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setConfirmingDelivery(null)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SCHEDULE DISPATCH MODAL                                       */}
      {/* ------------------------------------------------------------- */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-base text-slate-900">Schedule Delivery Dispatch</h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDelivery} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.businessName} ({c.community || "Adumasa"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Route</label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                >
                  <option value="">-- Select Route (Optional) --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Bags to Load</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={bagsAssigned}
                  onChange={(e) => setBagsAssigned(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-0.5">Aboboyaa tricycle capacity: ~60 bags</span>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl"
              >
                Schedule Delivery
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
