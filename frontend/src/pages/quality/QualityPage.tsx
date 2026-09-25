import React, { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, Plus, Sparkles, MessageSquare } from "lucide-react";
import { apiRequest } from "../../services/api.ts";
import { BatchQualityPanel } from "../../components/common/BatchQualityPanel.tsx";
import { SANITATION_AREAS } from "../../config/constants.ts";

interface QualityTest {
  id: string;
  testDate: string;
  testType: string;
  parameter: string;
  specificationReference: string;
  result: string;
  passFail: string;
  laboratory: string | null;
}

interface Complaint {
  id: string;
  complaintNumber: string;
  dateReceived: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  customer?: { businessName: string };
}

export const QualityPage: React.FC = () => {
  const [tests, setTests] = useState<QualityTest[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(Object.fromEntries(SANITATION_AREAS.map(area => [area, false])));
  const [cleaningSubmitted, setCleaningSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchQualityData = async () => {
    try {
      setLoading(true);
      const [testRes, compRes] = await Promise.all([
        apiRequest<{ tests: QualityTest[] }>("/quality/tests"),
        apiRequest<{ complaints: Complaint[] }>("/quality/complaints"),
      ]);
      if (testRes.data) setTests(testRes.data.tests);
      if (compRes.data) setComplaints(compRes.data.complaints);
    } catch (err) {
      console.error("Failed to load quality data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityData();
  }, []);

  const handleToggleChecklist = (area: string) => {
    setChecklist((prev) => ({ ...prev, [area]: !prev[area] }));
  };

  const handleSaveCleaning = async () => {
    try {
      await apiRequest("/quality/cleaning", {
        method: "POST",
        body: JSON.stringify({ checklist }),
      });
      setCleaningSubmitted(true);
      setTimeout(() => setCleaningSubmitted(false), 3000);
    } catch (err) {
      alert((err as Error).message || "Failed to record cleaning checklist");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <BatchQualityPanel />
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Quality Control & Factory Sanitation
          </h2>
          <p className="text-xs text-slate-500">
            Water laboratory analyses, daily sanitation checklists, and complaint investigations
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DAILY SANITATION CHECKLIST (Section 44)                       */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600" />
              Daily Factory Sanitation Checklist
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Food safety & hygiene compliance verification before production start
            </p>
          </div>
          {cleaningSubmitted && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Checklist Saved!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {Object.keys(checklist).map((area) => (
            <label
              key={area}
              onClick={() => handleToggleChecklist(area)}
              className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs font-bold transition ${
                checklist[area]
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              <input
                type="checkbox"
                checked={checklist[area]}
                onChange={() => {}} // Handled by label click
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="truncate">{area}</span>
            </label>
          ))}
        </div>

        <button
          onClick={handleSaveCleaning}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition"
        >
          CONFIRM & RECORD DAILY SANITATION
        </button>
      </div>

      {/* Quality Tests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-sm text-slate-900">Water Quality Lab Tests</h3>
          <span className="text-xs text-slate-500 font-mono">{tests.length} tests</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Test Type</th>
                <th className="p-3">Parameter</th>
                <th className="p-3">Standard Reference</th>
                <th className="p-3">Result</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">
                    No lab tests recorded yet.
                  </td>
                </tr>
              ) : (
                tests.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 text-slate-600">{new Date(t.testDate).toLocaleDateString("en-GB")}</td>
                    <td className="p-3 font-semibold text-slate-800">{t.testType}</td>
                    <td className="p-3 font-medium text-slate-700">{t.parameter}</td>
                    <td className="p-3 text-slate-500">{t.specificationReference}</td>
                    <td className="p-3 font-bold text-slate-900">{t.result}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {t.passFail}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
