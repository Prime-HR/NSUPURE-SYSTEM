import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Droplets,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShoppingCart,
  Factory,
  Wallet,
  Truck,
  Package,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { apiRequest } from "../../services/api.ts";
import { useAuth } from "../../context/AuthContext.tsx";

interface DashboardData {
  today: {
    productionBags: number;
    producedTotal: number;
    rejectedBags: number;
    rejectRate: number;
    salesBags: number;
    revenue: number;
    cashReceived: number;
    creditSales: number;
    expenses: number;
    deliveriesCompleted: number;
  };
  month: {
    productionBags: number;
    salesBags: number;
    revenue: number;
    expenses: number;
    estimatedOperatingSurplus: number;
    rejectRate: number;
    averageSellingPrice: number;
  };
  overall: {
    cashInTill: number;
    outstandingReceivables: number;
    activeCustomers: number;
  };
  alerts: Array<{
    type: string;
    title: string;
    message: string;
    severity: string;
    link?: string;
  }>;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoleView, setActiveRoleView] = useState<string>("OWNER");

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<DashboardData>("/dashboard/overview");
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  const today = data?.today;
  const month = data?.month;
  const overall = data?.overall;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* HEADER & ROLE DASHBOARD SELECTOR                              */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Nsupure Enterprise Operations
            <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800">
              GH₵7.00/bag
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Adumasa Factory, Juaben Constituency • Shift Hours: 8AM–12PM & 1PM–5PM
          </p>
        </div>

        {/* Role perspective selector (Section 66) */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs self-start md:self-auto overflow-x-auto">
          {["OWNER", "PRODUCTION", "SALES", "DRIVER", "FINANCE"].map((role) => (
            <button
              key={role}
              onClick={() => setActiveRoleView(role)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                activeRoleView === role
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* REAL DATA-DRIVEN ALERTS (Section 15)                          */}
      {/* ------------------------------------------------------------- */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                alert.severity === "HIGH"
                  ? "bg-red-50 border-red-200 text-red-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <AlertTriangle className={`w-5 h-5 shrink-0 ${alert.severity === "HIGH" ? "text-red-600" : "text-amber-600"}`} />
              <div className="flex-1">
                <div className="font-bold">{alert.title}</div>
                <div className="text-xs opacity-90 mt-0.5">{alert.message}</div>
              </div>
              {alert.link && (
                <Link
                  to={alert.link}
                  className="text-xs font-bold underline shrink-0 hover:opacity-80"
                >
                  View Details
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* QUICK WORKFLOW SHORTCUTS                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/sales"
          className="flex items-center gap-3 p-3.5 bg-gradient-to-br from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-xl shadow-sm transition active:scale-[0.98]"
        >
          <ShoppingCart className="w-5 h-5 shrink-0" />
          <div className="overflow-hidden">
            <p className="text-xs text-sky-200 uppercase font-bold tracking-wider">Fast Entry</p>
            <p className="text-sm font-black truncate">Record Sale</p>
          </div>
        </Link>
        <Link
          to="/production"
          className="flex items-center gap-3 p-3.5 bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl shadow-sm transition active:scale-[0.98]"
        >
          <Factory className="w-5 h-5 shrink-0" />
          <div className="overflow-hidden">
            <p className="text-xs text-indigo-200 uppercase font-bold tracking-wider">&lt; 1 Min</p>
            <p className="text-sm font-black truncate">Log Production</p>
          </div>
        </Link>
        <Link
          to="/deliveries"
          className="flex items-center gap-3 p-3.5 bg-gradient-to-br from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white rounded-xl shadow-sm transition active:scale-[0.98]"
        >
          <Truck className="w-5 h-5 shrink-0" />
          <div className="overflow-hidden">
            <p className="text-xs text-teal-200 uppercase font-bold tracking-wider">Tricycle</p>
            <p className="text-sm font-black truncate">Dispatch Bags</p>
          </div>
        </Link>
        <Link
          to="/finance"
          className="flex items-center gap-3 p-3.5 bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl shadow-sm transition active:scale-[0.98]"
        >
          <Wallet className="w-5 h-5 shrink-0" />
          <div className="overflow-hidden">
            <p className="text-xs text-emerald-200 uppercase font-bold tracking-wider">Closing</p>
            <p className="text-sm font-black truncate">Cash Reconcile</p>
          </div>
        </Link>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TOP SUMMARY: TODAY'S PERFORMANCE (Section 14)                 */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-600" />
            Today's Operational Summary
          </h3>
          <span className="text-xs text-slate-400 font-mono">{new Date().toLocaleDateString("en-GB")}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Good Bags Produced</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{today?.productionBags || 0}</span>
              <span className="text-xs text-slate-500">bags</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
              <span>Rejects: {today?.rejectedBags || 0}</span>
              <span className={`font-bold ${today && today.rejectRate > 3 ? "text-red-600" : "text-emerald-600"}`}>
                {today?.rejectRate || 0}% rate
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Today's Sales</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-sky-700">{today?.salesBags || 0}</span>
              <span className="text-xs text-slate-500">bags sold</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-600 font-mono">
              Revenue: GH₵{(today?.revenue || 0).toFixed(2)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Cash Received</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs text-slate-400 font-mono">GH₵</span>
              <span className="text-2xl font-black text-emerald-600">{(today?.cashReceived || 0).toFixed(2)}</span>
            </div>
            <div className="mt-2 text-[11px] text-amber-600 font-medium">
              Credit created: GH₵{(today?.creditSales || 0).toFixed(2)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Cash in Till</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs text-slate-400 font-mono">GH₵</span>
              <span className="text-2xl font-black text-slate-900">{(overall?.cashInTill || 0).toFixed(2)}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Today Expenses: GH₵{(today?.expenses || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MONTH SUMMARY: FINANCIAL & EFFICIENCY METRICS (Section 14)    */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Monthly Operational Performance
            </h3>
            <p className="text-xs text-slate-500">
              Estimated management operating figures (distinguished from audited figures)
            </p>
          </div>
          <Link
            to="/reports"
            className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            Full Report <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] text-slate-500 font-medium">Production</p>
            <p className="text-lg font-black text-slate-900 mt-1">{month?.productionBags || 0}</p>
            <span className="text-[10px] text-slate-400">good bags</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] text-slate-500 font-medium">Sales Volume</p>
            <p className="text-lg font-black text-slate-900 mt-1">{month?.salesBags || 0}</p>
            <span className="text-[10px] text-slate-400">bags sold</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] text-slate-500 font-medium">Gross Revenue</p>
            <p className="text-lg font-black text-slate-900 mt-1">GH₵{(month?.revenue || 0).toFixed(2)}</p>
            <span className="text-[10px] text-sky-600">@ GH₵{(month?.averageSellingPrice || 7).toFixed(2)}/bag</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] text-slate-500 font-medium">Operating Expenses</p>
            <p className="text-lg font-black text-slate-900 mt-1">GH₵{(month?.expenses || 0).toFixed(2)}</p>
            <span className="text-[10px] text-slate-400">recorded costs</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-[11px] text-emerald-800 font-medium">Operating Surplus</p>
            <p className="text-lg font-black text-emerald-700 mt-1">
              GH₵{(month?.estimatedOperatingSurplus || 0).toFixed(2)}
            </p>
            <span className="text-[10px] text-emerald-600 font-medium">Management Est.</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-[11px] text-amber-800 font-medium">Trade Receivables</p>
            <p className="text-lg font-black text-amber-700 mt-1">
              GH₵{(overall?.outstandingReceivables || 0).toFixed(2)}
            </p>
            <span className="text-[10px] text-amber-600 font-medium">Customer Credit</span>
          </div>
        </div>
      </div>
    </div>
  );
};
