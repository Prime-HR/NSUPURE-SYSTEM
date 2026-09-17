import React, { useState, useEffect } from "react";
import { Wallet, Plus, CheckCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface CashTransaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  runningBalance: number;
  reference: string | null;
  payeePayer: string | null;
  notes: string | null;
}

interface Expense {
  id: string;
  expenseNumber: string;
  date: string;
  category: string;
  description: string;
  payee: string;
  amount: number;
  paymentMethod: string;
}

export const FinancePage: React.FC = () => {
  const [currentCash, setCurrentCash] = useState<number>(0);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [costPerBagData, setCostPerBagData] = useState<{
    costPerBag: number;
    totalOperatingCost: number;
    totalBagsSold: number;
  } | null>(null);

  // Cash Count Reconciliation State (Section 31)
  const [physicalCashInput, setPhysicalCashInput] = useState<number>(0);
  const [discrepancyExplanation, setDiscrepancyExplanation] = useState<string>("");
  const [reconcileResult, setReconcileResult] = useState<{
    difference: number;
    status: string;
    message: string;
  } | null>(null);

  // New Expense State (Section 30)
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expCategory, setExpCategory] = useState("ELECTRICITY");
  const [expDesc, setExpDesc] = useState("");
  const [expPayee, setExpPayee] = useState("");
  const [expAmount, setExpAmount] = useState<number>(50);
  const [expMethod, setExpMethod] = useState<"CASH" | "BANK" | "MOMO">("CASH");

  // Owner Transaction State (Section 34)
  const [showOwnerModal, setShowOwnerModal] = useState(false);
  const [ownerType, setOwnerType] = useState<"OWNER_CONTRIBUTION" | "OWNER_WITHDRAWAL">("OWNER_WITHDRAWAL");
  const [ownerAmount, setOwnerAmount] = useState<number>(200);
  const [ownerDesc, setOwnerDesc] = useState("");

  const fetchFinanceData = async () => {
    try {
      const [cashRes, expRes, costRes] = await Promise.all([
        apiRequest<{ currentBalance: number; transactions: CashTransaction[] }>("/finance/cashbook"),
        apiRequest<{ expenses: Expense[]; totalAmount: number }>("/finance/expenses"),
        apiRequest<{ costPerBag: number; totalOperatingCost: number; totalBagsSold: number }>("/finance/cost-per-bag"),
      ]);

      if (cashRes.data) {
        setCurrentCash(cashRes.data.currentBalance);
        setCashTransactions(cashRes.data.transactions);
        setPhysicalCashInput(cashRes.data.currentBalance);
      }
      if (expRes.data) {
        setExpenses(expRes.data.expenses);
      }
      if (costRes.data) {
        setCostPerBagData(costRes.data);
      }
    } catch (err) {
      console.error("Failed to load finance data", err);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const handleReconcileCash = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{
        difference: number;
        status: string;
        expectedCash: number;
        actualPhysicalCash: number;
      }>("/finance/cashbook/count", {
        method: "POST",
        body: JSON.stringify({
          actualPhysicalCash: physicalCashInput,
          explanationIfDiscrepancy: discrepancyExplanation,
        }),
      });

      if (res.data) {
        setReconcileResult({
          difference: res.data.difference,
          status: res.data.status,
          message: res.message || "Reconciliation completed",
        });
        fetchFinanceData();
      }
    } catch (err) {
      alert((err as Error).message || "Failed to reconcile cash");
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/finance/expenses", {
        method: "POST",
        body: JSON.stringify({
          category: expCategory,
          description: expDesc,
          payee: expPayee,
          amount: expAmount,
          paymentMethod: expMethod,
        }),
      });
      setShowExpenseModal(false);
      setExpDesc("");
      setExpPayee("");
      fetchFinanceData();
    } catch (err) {
      alert((err as Error).message || "Failed to create expense");
    }
  };

  const handleOwnerTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/finance/owner-transaction", {
        method: "POST",
        body: JSON.stringify({
          type: ownerType,
          amount: ownerAmount,
          paymentMethod: "CASH",
          description: ownerDesc,
        }),
      });
      setShowOwnerModal(false);
      setOwnerDesc("");
      fetchFinanceData();
    } catch (err) {
      alert((err as Error).message || "Failed to record owner transaction");
    }
  };

  const calculatedDiff = Math.round((physicalCashInput - currentCash + Number.EPSILON) * 100) / 100;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            Cashbook & Financial Control
          </h2>
          <p className="text-xs text-slate-500">
            Cash counting, expense tracking, and cost per bag analysis
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowOwnerModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition"
          >
            Owner Capital / Drawings
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Record Expense
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* KPI METRICS (Cash & Cost Per Bag)                             */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Cash in Till</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-sm font-mono text-slate-400">GH₵</span>
            <span className="text-3xl font-black text-slate-900">{currentCash.toFixed(2)}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Factory Cash Safe / Cashbook Balance</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cost per Bag Sold</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-sm font-mono text-slate-400">GH₵</span>
            <span className="text-3xl font-black text-indigo-700">
              {costPerBagData?.costPerBag.toFixed(2) || "0.00"}
            </span>
            <span className="text-xs text-slate-500">/ bag</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Operating Costs: GH₵{costPerBagData?.totalOperatingCost.toFixed(2) || "0.00"}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Default Selling Price</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-sm font-mono text-slate-400">GH₵</span>
            <span className="text-3xl font-black text-emerald-600">7.00</span>
            <span className="text-xs text-slate-500">/ bag</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-2">
            Gross Margin: ~GH₵{(7.0 - (costPerBagData?.costPerBag || 5.0)).toFixed(2)}/bag
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DAILY CASHBOOK COUNT RECONCILIATION (Section 31)              */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="border-b pb-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Daily Cash Reconciliation & Physical Count
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Count physical notes and coins in factory till. If discrepancy exists, formal explanation is mandatory.
          </p>
        </div>

        <form onSubmit={handleReconcileCash} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Actual Physical Cash Counted (GH₵)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                required
                value={physicalCashInput}
                onChange={(e) => setPhysicalCashInput(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-base font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center">
              <span className="text-[11px] text-slate-500 font-medium">Reconciliation Variance:</span>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xl font-black font-mono ${
                    calculatedDiff === 0
                      ? "text-emerald-600"
                      : calculatedDiff > 0
                      ? "text-sky-600"
                      : "text-red-600"
                  }`}
                >
                  {calculatedDiff > 0 ? `+GH₵${calculatedDiff.toFixed(2)} (Surplus)` : calculatedDiff < 0 ? `-GH₵${Math.abs(calculatedDiff).toFixed(2)} (Shortage)` : "GH₵0.00 (Balanced)"}
                </span>
              </div>
            </div>
          </div>

          {calculatedDiff !== 0 && (
            <div>
              <label className="block text-xs font-bold text-red-600 mb-1">
                Explanation for Cash Discrepancy (Mandatory)
              </label>
              <input
                type="text"
                required
                placeholder="Reason for cash difference (e.g. Unrecorded fuel purchase, change error)"
                value={discrepancyExplanation}
                onChange={(e) => setDiscrepancyExplanation(e.target.value)}
                className="w-full bg-red-50/50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-900 focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
          >
            CONFIRM PHYSICAL CASH COUNT
          </button>
        </form>

        {reconcileResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
            {reconcileResult.message}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RECENT EXPENSES TABLE (Section 30)                            */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-sm text-slate-900">Recorded Operating Expenses</h3>
          <span className="text-xs text-slate-500 font-mono">{expenses.length} expenses</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Expense #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3">Payee</th>
                <th className="p-3">Method</th>
                <th className="p-3 text-right">Amount (GH₵)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">No expenses recorded yet.</td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono text-slate-500">{e.expenseNumber}</td>
                    <td className="p-3 text-slate-600">{new Date(e.date).toLocaleDateString("en-GB")}</td>
                    <td className="p-3 font-semibold text-slate-800">{e.category}</td>
                    <td className="p-3 text-slate-700">{e.description}</td>
                    <td className="p-3 text-slate-600">{e.payee}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {e.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">{e.amount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RECORD EXPENSE MODAL                                          */}
      {/* ------------------------------------------------------------- */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="font-black text-base text-slate-900 mb-4">Record Operating Expense</h3>
            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                >
                  <option value="ELECTRICITY">Electricity (ECG / Prepaid)</option>
                  <option value="FUEL_PETROL">Fuel (Petrol for Tricycle)</option>
                  <option value="FUEL_DIESEL">Fuel (Diesel for Generator)</option>
                  <option value="TREATMENT_CHEMICALS">Water Treatment Chemicals</option>
                  <option value="FILTERS">Filter Cartridges & Media</option>
                  <option value="SACHET_FILM">Sachet Packaging Film</option>
                  <option value="OUTER_BAGS">Outer Packaging Bags</option>
                  <option value="MAINTENANCE">Machine / Plant Maintenance</option>
                  <option value="CLEANING">Sanitation & Cleaning Agents</option>
                  <option value="REGULATORY">Regulatory (FDA / GSA / EPA / Fire)</option>
                  <option value="LABORATORY_TESTING">Water Laboratory Testing</option>
                  <option value="TRANSPORTATION">Transportation & Trips</option>
                  <option value="OFFICE">Office & Communication</option>
                  <option value="OTHER">Other Operating Expense</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECG Power purchase for production week 38"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payee / Vendor</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ECG Juaben, Goil Petrol"
                    value={expPayee}
                    onChange={(e) => setExpPayee(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (GH₵)</label>
                  <input
                    type="number"
                    step="0.50"
                    min="1"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Paid From</label>
                <select
                  value={expMethod}
                  onChange={(e) => setExpMethod(e.target.value as "CASH" | "BANK" | "MOMO")}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                >
                  <option value="CASH">Factory Cash Safe / Till</option>
                  <option value="MOMO">Mobile Money (MTN MoMo)</option>
                  <option value="BANK">Business Bank Account</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* OWNER CAPITAL / DRAWINGS MODAL (Section 34)                   */}
      {/* ------------------------------------------------------------- */}
      {showOwnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="font-black text-base text-slate-900 mb-1">Owner Capital & Personal Drawings</h3>
            <p className="text-[11px] text-slate-500 mb-4">
              Owner money is strictly separated from operational revenue and business expenses.
            </p>

            <form onSubmit={handleOwnerTransaction} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOwnerType("OWNER_CONTRIBUTION")}
                  className={`py-2 text-xs font-bold rounded-xl border transition ${
                    ownerType === "OWNER_CONTRIBUTION"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  Owner Contribution (+)
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerType("OWNER_WITHDRAWAL")}
                  className={`py-2 text-xs font-bold rounded-xl border transition ${
                    ownerType === "OWNER_WITHDRAWAL"
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  Owner Drawing (-)
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (GH₵)</label>
                <input
                  type="number"
                  step="10"
                  min="1"
                  required
                  value={ownerAmount}
                  onChange={(e) => setOwnerAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Personal draw for living expenses / Personal fund injection"
                  value={ownerDesc}
                  onChange={(e) => setOwnerDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOwnerModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                >
                  Confirm Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
