import React, { useState, useEffect } from "react";
import { Building2, Wrench, DollarSign, Plus, CheckCircle2 } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  condition: string;
  currentEstimatedValue: number | null;
  originalCost: number | null;
  isProfessionallyAppraised: boolean;
}

interface Loan {
  id: string;
  loanCode: string;
  lenderName: string;
  purpose: string | null;
  originalPrincipal: number;
  currentBalance: number;
  status: string;
  isManagementConfirmed: boolean;
}

export const AssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  // Pay Loan Modal
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [principalPaid, setPrincipalPaid] = useState<number>(1000);
  const [interestPaid, setInterestPaid] = useState<number>(0);

  const fetchAssetsData = async () => {
    try {
      setLoading(true);
      const [astRes, lonRes] = await Promise.all([
        apiRequest<{ assets: Asset[] }>("/assets"),
        apiRequest<{ loans: Loan[] }>("/assets/loans"),
      ]);
      if (astRes.data) setAssets(astRes.data.assets);
      if (lonRes.data) setLoans(lonRes.data.loans);
    } catch (err) {
      console.error("Failed to load assets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssetsData();
  }, []);

  const handlePayLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLoan) return;

    try {
      await apiRequest("/assets/loans/pay", {
        method: "POST",
        body: JSON.stringify({
          loanId: payingLoan.id,
          principalPaid,
          interestPaid,
        }),
      });
      setPayingLoan(null);
      fetchAssetsData();
    } catch (err) {
      alert((err as Error).message || "Loan repayment failed");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Plant Equipment Assets & Liabilities
          </h2>
          <p className="text-xs text-slate-500">
            Adumasa Factory machinery, borehole, tanks, vehicles, and long-term liabilities
          </p>
        </div>
      </div>

      {/* Assets Registry Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-sm text-slate-900">Registered Plant Equipment Assets</h3>
          <span className="text-xs text-slate-500 font-mono">{assets.length} assets</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Asset Code</th>
                <th className="p-3">Equipment / Asset Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Condition</th>
                <th className="p-3 text-right">Estimated Value</th>
                <th className="p-3 text-center">Valuation Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-400">Loading assets...</td></tr>
              ) : assets.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-400">No assets registered yet.</td></tr>
              ) : (
                assets.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono text-slate-500">{a.assetCode}</td>
                    <td className="p-3 font-bold text-slate-900">{a.name}</td>
                    <td className="p-3 text-slate-600">{a.category}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {a.condition}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">
                      GH₵{(a.currentEstimatedValue || a.originalCost || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {a.isProfessionallyAppraised ? "Appraised" : "Management Est."}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Liabilities & Debt Table (Section 42) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-black text-sm text-slate-900">Business Liabilities & Loans</h3>
            <p className="text-[11px] text-slate-500">Tracked and amortized upon management confirmation</p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-700">{loans.length} Loans</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Loan Code</th>
                <th className="p-3">Lender / Creditor</th>
                <th className="p-3">Purpose</th>
                <th className="p-3 text-right">Original Principal</th>
                <th className="p-3 text-right">Current Balance</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Repay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-center text-slate-400">No active loans recorded.</td></tr>
              ) : (
                loans.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono text-slate-500">{l.loanCode}</td>
                    <td className="p-3 font-bold text-slate-900">{l.lenderName}</td>
                    <td className="p-3 text-slate-600">{l.purpose || "Business liability"}</td>
                    <td className="p-3 text-right font-medium text-slate-700">GH₵{l.originalPrincipal.toFixed(2)}</td>
                    <td className="p-3 text-right font-black text-red-600">GH₵{l.currentBalance.toFixed(2)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {l.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setPayingLoan(l);
                          setPrincipalPaid(Math.min(1000, l.currentBalance));
                        }}
                        className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Loan Modal */}
      {payingLoan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="font-black text-base text-slate-900 mb-1">Record Loan Repayment</h3>
            <p className="text-xs text-slate-500 mb-4">{payingLoan.lenderName}</p>

            <form onSubmit={handlePayLoan} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Principal Paid (GH₵)</label>
                <input
                  type="number"
                  step="50"
                  required
                  value={principalPaid}
                  onChange={(e) => setPrincipalPaid(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Interest Paid (GH₵)</label>
                <input
                  type="number"
                  step="10"
                  value={interestPaid}
                  onChange={(e) => setInterestPaid(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between font-bold">
                <span>Total Disbursed:</span>
                <span className="text-emerald-700 font-black">
                  GH₵{(principalPaid + interestPaid).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPayingLoan(null)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  Confirm Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
