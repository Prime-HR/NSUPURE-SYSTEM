import React, { useState, useEffect } from "react";
import { Package, AlertTriangle, Plus, ArrowUpDown } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface InventoryItem {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  unitCost: number;
}

export const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<"PURCHASE" | "PRODUCTION_USAGE" | "DAMAGE" | "ADJUSTMENT">("PRODUCTION_USAGE");

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ items: InventoryItem[] }>("/inventory/items");
      if (res.data) setItems(res.data.items);
    } catch (err) {
      console.error("Failed to load inventory", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      await apiRequest("/inventory/transactions", {
        method: "POST",
        body: JSON.stringify({
          itemId: selectedItem.id,
          transactionType: adjustType,
          quantity: adjustQty,
        }),
      });
      setSelectedItem(null);
      fetchInventory();
    } catch (err) {
      alert((err as Error).message || "Stock movement failed");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            Raw Materials & Inventory
          </h2>
          <p className="text-xs text-slate-500">
            Sachet film rolls, outer packaging bags, treatment chemicals, and fuel
          </p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Item Code</th>
                <th className="p-3.5">Material Name</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-right">Current Stock</th>
                <th className="p-3.5 text-right">Reorder Level</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">Loading stock items...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">No inventory registered.</td>
                </tr>
              ) : (
                items.map((i) => {
                  const isLow = i.currentStock <= i.reorderLevel;
                  return (
                    <tr key={i.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3.5 font-mono text-slate-500">{i.itemCode}</td>
                      <td className="p-3.5 font-bold text-slate-900">{i.name}</td>
                      <td className="p-3.5 text-slate-600">{i.category}</td>
                      <td className="p-3.5 text-right font-black text-slate-900">
                        {i.currentStock} {i.unit}
                      </td>
                      <td className="p-3.5 text-right text-slate-500 font-mono">
                        {i.reorderLevel} {i.unit}
                      </td>
                      <td className="p-3.5">
                        {isLow ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Adequate
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedItem(i);
                            setAdjustQty(1);
                          }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1 transition"
                        >
                          <ArrowUpDown className="w-3 h-3" /> Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="font-black text-base text-slate-900 mb-1">Record Stock Movement</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedItem.name}</p>

            <form onSubmit={handleAdjustStock} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Movement Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold"
                >
                  <option value="PRODUCTION_USAGE">Production Usage (-)</option>
                  <option value="PURCHASE">Purchase Arrival (+)</option>
                  <option value="DAMAGE">Damaged / Scrapped (-)</option>
                  <option value="ADJUSTMENT">Stocktake Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Quantity ({selectedItem.unit})
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-sm"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  Confirm Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
