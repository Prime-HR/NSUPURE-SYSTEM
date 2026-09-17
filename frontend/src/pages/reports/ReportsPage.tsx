import React, { useState, useEffect } from "react";
import { BarChart3, Printer, CheckCircle2, AlertCircle, FileText, TrendingUp, DollarSign } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface MonthlyReportData {
  reportHeader: {
    title: string;
    companyName: string;
    factoryLocation: string;
    period: string;
    disclaimer: string;
  };
  currentMonth: {
    goodBagsProduced: number;
    bagsProducedTotal: number;
    rejectedBags: number;
    rejectRate: number;
    bagsSold: number;
    totalRevenue: number;
    creditSales: number;
    cashExpenses: number;
    estimatedOperatingSurplus: number;
    costPerBag: number;
    deliveriesCompleted: number;
    complaintsRecorded: number;
    qualityTestsPassed: number;
  };
  previousMonth: {
    goodBagsProduced: number;
    bagsSold: number;
    totalRevenue: number;
    cashExpenses: number;
  };
  growthIndicators: {
    revenueGrowthPct: number;
    productionGrowthPct: number;
    expensesGrowthPct: number;
  };
  financialPosition: {
    totalTradeReceivables: number;
    activeLiabilities: number;
    totalAssetsRegistered: number;
    totalVehicles: number;
  };
  insights: string[];
}

interface InvestorReportData {
  reportHeader: {
    title: string;
    enterpriseName: string;
    factoryLocation: string;
    establishedDate: string;
  };
  executiveSummary: {
    businessModel: string;
    coreProduct: string;
    standardUnitPrice: string;
  };
  operationalTrackRecord: {
    cumulativeBagsManufactured: number;
    cumulativeBagsSold: number;
    cumulativeGrossRevenue: number;
    cumulativeOperatingExpenses: number;
    cumulativeOperatingSurplus: number;
  };
  recurringCustomerPortfolio: {
    activeRecurringArrangements: number;
    plannedVolumePerCycle: number;
    keyRecurringAccounts: Array<{
      customer: string;
      community: string;
      quantityBags: number;
      frequency: string;
    }>;
  };
  balanceSheetSummary: {
    totalRegisteredAssetsEstimate: number;
    totalTradeReceivables: number;
    totalConfirmedLiabilities: number;
  };
}

interface ReadinessData {
  checklistItems: Array<{
    area: string;
    status: string;
    description: string;
  }>;
  readinessScorePct: number;
  completedCount: number;
  totalItems: number;
}

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"MONTHLY" | "INVESTOR" | "READINESS">("MONTHLY");
  const [monthlyData, setMonthlyData] = useState<MonthlyReportData | null>(null);
  const [investorData, setInvestorData] = useState<InvestorReportData | null>(null);
  const [readinessData, setReadinessData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      try {
        if (activeTab === "MONTHLY") {
          const res = await apiRequest<MonthlyReportData>("/reports/monthly-management");
          if (res.data) setMonthlyData(res.data);
        } else if (activeTab === "INVESTOR") {
          const res = await apiRequest<InvestorReportData>("/reports/investor-report");
          if (res.data) setInvestorData(res.data);
        } else if (activeTab === "READINESS") {
          const res = await apiRequest<ReadinessData>("/reports/readiness-checklist");
          if (res.data) setReadinessData(res.data);
        }
      } catch (err) {
        console.error("Failed to load reports", err);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [activeTab]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Tab Selector */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-600" />
            Executive Reports & Investor Dossier
          </h2>
          <p className="text-xs text-slate-500">
            Certified operational performance, financing reports, and business readiness
          </p>
        </div>

        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab("MONTHLY")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "MONTHLY" ? "bg-white text-sky-700 shadow-sm" : "text-slate-600"
            }`}
          >
            Monthly Management
          </button>
          <button
            onClick={() => setActiveTab("INVESTOR")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "INVESTOR" ? "bg-white text-sky-700 shadow-sm" : "text-slate-600"
            }`}
          >
            Investor Report
          </button>
          <button
            onClick={() => setActiveTab("READINESS")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "READINESS" ? "bg-white text-sky-700 shadow-sm" : "text-slate-600"
            }`}
          >
            Readiness Checklist
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------------- */}
          {/* TAB 1: MONTHLY MANAGEMENT REPORT (Section 55)                 */}
          {/* ------------------------------------------------------------- */}
          {activeTab === "MONTHLY" && monthlyData && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 printable-card">
              {/* Document Header */}
              <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{monthlyData.reportHeader.title}</h3>
                  <p className="text-sm font-bold text-sky-700">{monthlyData.reportHeader.companyName}</p>
                  <p className="text-xs text-slate-500">{monthlyData.reportHeader.factoryLocation}</p>
                  <p className="text-xs text-slate-600 font-mono mt-1">Period: {monthlyData.reportHeader.period}</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 no-print shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print PDF
                </button>
              </div>

              {/* Statutory Disclaimer (Section 35) */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium">
                {monthlyData.reportHeader.disclaimer}
              </div>

              {/* Data-Driven Insights (Section 59) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Key Operational Insights (Derived Mathematically)
                </p>
                <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                  {monthlyData.insights.map((ins, i) => (
                    <li key={i}>{ins}</li>
                  ))}
                </ul>
              </div>

              {/* Performance Comparison Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Operating Metrics & Month-over-Month Comparison
                </h4>
                <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2.5">Indicator</th>
                      <th className="p-2.5 text-right">Current Month</th>
                      <th className="p-2.5 text-right">Previous Month</th>
                      <th className="p-2.5 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 font-medium">Good Bags Produced</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        {monthlyData.currentMonth.goodBagsProduced}
                      </td>
                      <td className="p-2.5 text-right text-slate-500">
                        {monthlyData.previousMonth.goodBagsProduced}
                      </td>
                      <td className="p-2.5 text-right font-bold text-sky-700">
                        {monthlyData.growthIndicators.productionGrowthPct}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Bags Sold</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        {monthlyData.currentMonth.bagsSold}
                      </td>
                      <td className="p-2.5 text-right text-slate-500">
                        {monthlyData.previousMonth.bagsSold}
                      </td>
                      <td className="p-2.5 text-right text-slate-500">—</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Gross Revenue (GH₵)</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">
                        {monthlyData.currentMonth.totalRevenue.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-slate-500">
                        {monthlyData.previousMonth.totalRevenue.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">
                        {monthlyData.growthIndicators.revenueGrowthPct}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Operating Expenses (GH₵)</td>
                      <td className="p-2.5 text-right font-bold text-red-600">
                        {monthlyData.currentMonth.cashExpenses.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-slate-500">
                        {monthlyData.previousMonth.cashExpenses.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-red-600">
                        {monthlyData.growthIndicators.expensesGrowthPct}%
                      </td>
                    </tr>
                    <tr className="bg-slate-50/80 font-bold">
                      <td className="p-2.5">Operating Surplus (GH₵)</td>
                      <td className="p-2.5 text-right text-slate-900 text-sm">
                        {monthlyData.currentMonth.estimatedOperatingSurplus.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-slate-500">—</td>
                      <td className="p-2.5 text-right text-slate-500">—</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Estimated Operating Cost per Bag</td>
                      <td className="p-2.5 text-right font-bold text-indigo-700">
                        GH₵{monthlyData.currentMonth.costPerBag.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right text-slate-500">—</td>
                      <td className="p-2.5 text-right text-slate-500">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sign-off section */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-600">
                <div>
                  <p className="font-bold">Prepared By:</p>
                  <p className="mt-4 border-b border-slate-300 pb-1">Operations / Finance Officer</p>
                  <p className="text-[10px] text-slate-400 mt-1">Date: {new Date().toLocaleDateString("en-GB")}</p>
                </div>
                <div>
                  <p className="font-bold">Approved By:</p>
                  <p className="mt-4 border-b border-slate-300 pb-1">Managing Proprietor (Nsupure Enterprise)</p>
                  <p className="text-[10px] text-slate-400 mt-1">Date: ________________________</p>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 2: INVESTOR & FINANCING REPORT (Section 56)               */}
          {/* ------------------------------------------------------------- */}
          {activeTab === "INVESTOR" && investorData && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 printable-card">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{investorData.reportHeader.title}</h3>
                  <p className="text-sm font-bold text-sky-700">{investorData.reportHeader.enterpriseName}</p>
                  <p className="text-xs text-slate-500">{investorData.reportHeader.factoryLocation} • Est. {investorData.reportHeader.establishedDate}</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 no-print shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print Dossier
                </button>
              </div>

              {/* Executive Summary */}
              <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 text-xs space-y-1.5">
                <p className="font-bold text-sky-900 uppercase tracking-wider">Business Model & Distribution Infrastructure</p>
                <p className="text-slate-700 leading-relaxed">{investorData.executiveSummary.businessModel}</p>
                <p className="font-semibold text-slate-900 pt-1">
                  Core Offering: {investorData.executiveSummary.coreProduct} at standard factory rate of {investorData.executiveSummary.standardUnitPrice}.
                </p>
              </div>

              {/* Cumulative Track Record */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Cumulative Recorded Financial & Operating Realities
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl border">
                    <p className="text-[11px] text-slate-500">Manufactured</p>
                    <p className="text-base font-black text-slate-900 mt-1">
                      {investorData.operationalTrackRecord.cumulativeBagsManufactured} bags
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border">
                    <p className="text-[11px] text-slate-500">Gross Sales</p>
                    <p className="text-base font-black text-emerald-700 mt-1">
                      GH₵{investorData.operationalTrackRecord.cumulativeGrossRevenue.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border">
                    <p className="text-[11px] text-slate-500">Operating Costs</p>
                    <p className="text-base font-black text-slate-800 mt-1">
                      GH₵{investorData.operationalTrackRecord.cumulativeOperatingExpenses.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border">
                    <p className="text-[11px] text-slate-500">Operating Surplus</p>
                    <p className="text-base font-black text-emerald-600 mt-1">
                      GH₵{investorData.operationalTrackRecord.cumulativeOperatingSurplus.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recurring Supply Contracts (Section 9) */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Key Recurring Supply Portfolio ({investorData.recurringCustomerPortfolio.plannedVolumePerCycle} Bags / Supply Cycle)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="p-2.5">Customer Account</th>
                        <th className="p-2.5">Community</th>
                        <th className="p-2.5 text-right">Bags / Cycle</th>
                        <th className="p-2.5">Frequency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {investorData.recurringCustomerPortfolio.keyRecurringAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-3 text-center text-slate-400">
                            Recurring customer supply schedules logged upon confirmation.
                          </td>
                        </tr>
                      ) : (
                        investorData.recurringCustomerPortfolio.keyRecurringAccounts.map((ro, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold text-slate-900">{ro.customer}</td>
                            <td className="p-2.5 text-slate-600">{ro.community}</td>
                            <td className="p-2.5 text-right font-black text-slate-900">{ro.quantityBags}</td>
                            <td className="p-2.5 font-mono text-sky-700">{ro.frequency}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 3: FINANCIAL READINESS CHECKLIST (Section 57)             */}
          {/* ------------------------------------------------------------- */}
          {activeTab === "READINESS" && readinessData && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Commercial & Financial Readiness Checklist</h3>
                  <p className="text-xs text-slate-500">
                    Institutional verification for commercial banking and investor due diligence
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-sky-700">{readinessData.readinessScorePct}%</span>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Readiness Score</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {readinessData.checklistItems.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 flex items-start gap-3 bg-slate-50/50">
                    {item.status === "COMPLETE" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900">{item.area}</p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            item.status === "COMPLETE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
