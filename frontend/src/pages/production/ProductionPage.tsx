import React, { useState, useEffect } from "react";
import { Factory, CheckCircle, Clock, Droplets, AlertTriangle, Package, ShieldCheck } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface ProductionRun {
  id: string;
  runNumber: string;
  date: string;
  shift: string;
  bagsProduced: number;
  rejectedBags: number;
  goodBags: number;
  rejectRatePct: number;
  productionPerHour: number;
  machineHours: number;
  downtimeMinutes: number;
  qcStatus: string;
  batches: Array<{ batchNumber: string }>;
}

export const ProductionPage: React.FC = () => {
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State (< 1 Minute Entry)
  const [shift, setShift] = useState<"MORNING_8_12" | "AFTERNOON_1_5">("MORNING_8_12");
  const [machineHours, setMachineHours] = useState<number>(4.0);
  const [bagsProduced, setBagsProduced] = useState<number>(150);
  const [rejectedBags, setRejectedBags] = useState<number>(2);
  const [openingRawWater, setOpeningRawWater] = useState<number>(1800);
  const [closingRawWater, setClosingRawWater] = useState<number>(1200);
  const [openingPurifiedWater, setOpeningPurifiedWater] = useState<number>(1000);
  const [closingPurifiedWater, setClosingPurifiedWater] = useState<number>(400);
  const [packagingUsedRolls, setPackagingUsedRolls] = useState<number>(1.0);
  const [outerBagsUsed, setOuterBagsUsed] = useState<number>(150);
  const [downtimeMinutes, setDowntimeMinutes] = useState<number>(0);
  const [downtimeReason, setDowntimeReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculated variables
  const goodBags = Math.max(0, bagsProduced - rejectedBags);
  const rejectRate = bagsProduced > 0 ? Number(((rejectedBags / bagsProduced) * 100).toFixed(2)) : 0;
  const productionPerHour = machineHours > 0 ? Number((goodBags / machineHours).toFixed(1)) : 0;

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ runs: ProductionRun[] }>("/production/runs");
      if (res.data) {
        setRuns(res.data.runs);
      }
    } catch (err) {
      console.error("Failed to fetch production runs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const res = await apiRequest<{ run: ProductionRun; batch: { batchNumber: string } }>("/production/runs", {
        method: "POST",
        body: JSON.stringify({
          shift,
          machineHours,
          bagsProduced,
          rejectedBags,
          openingRawWaterLevel: openingRawWater,
          closingRawWaterLevel: closingRawWater,
          openingPurifiedWaterLevel: openingPurifiedWater,
          closingPurifiedWaterLevel: closingPurifiedWater,
          packagingUsedRolls,
          outerBagsUsed,
          downtimeMinutes,
          downtimeReason: downtimeReason || undefined,
          notes: notes || undefined,
        }),
      });

      if (res.data) {
        setSuccessMessage(`Logged ${goodBags} good bags. Assigned Batch: ${res.data.batch.batchNumber}`);
        fetchRuns();
      }
    } catch (err) {
      alert((err as Error).message || "Failed to record production run");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Factory className="w-5 h-5 text-indigo-600" />
            Daily Water Production & Shifts
          </h2>
          <p className="text-xs text-slate-500">
            Adumasa Factory Sachet Filling & Sealing Operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
            30 Sachets = 1 Bag
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1-MINUTE PRODUCTION LOGGING FORM (Section 25 & 82)            */}
      {/* ------------------------------------------------------------- */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <Clock className="w-4 h-4 text-slate-500" />
          Record Shift Production
        </h3>

        {/* Shift Selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setShift("MORNING_8_12")}
            className={`py-3 px-4 rounded-xl text-xs font-bold border transition text-center ${
              shift === "MORNING_8_12"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            Morning Shift (8:00 AM – 12:00 PM)
          </button>
          <button
            type="button"
            onClick={() => setShift("AFTERNOON_1_5")}
            className={`py-3 px-4 rounded-xl text-xs font-bold border transition text-center ${
              shift === "AFTERNOON_1_5"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            Afternoon Shift (1:00 PM – 5:00 PM)
          </button>
        </div>

        {/* Production Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Total Bags Produced</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              required
              value={bagsProduced}
              onChange={(e) => setBagsProduced(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Rejected / Leaking Bags</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              required
              value={rejectedBags}
              onChange={(e) => setRejectedBags(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Machine Operating Hours</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.5"
              required
              value={machineHours}
              onChange={(e) => setMachineHours(parseFloat(e.target.value) || 4.0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Real-time Math Display */}
        <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 grid grid-cols-3 gap-3 text-center">
          <div>
            <span className="text-[11px] text-indigo-900 font-semibold">Good Bags (Stock)</span>
            <p className="text-xl font-black text-indigo-700 mt-0.5">{goodBags}</p>
          </div>
          <div>
            <span className="text-[11px] text-indigo-900 font-semibold">Reject Rate</span>
            <p className={`text-xl font-black mt-0.5 ${rejectRate > 3 ? "text-red-600" : "text-emerald-600"}`}>
              {rejectRate}%
            </p>
          </div>
          <div>
            <span className="text-[11px] text-indigo-900 font-semibold">Production Rate</span>
            <p className="text-xl font-black text-slate-800 mt-0.5">{productionPerHour} / hr</p>
          </div>
        </div>

        {/* Water Tanks & Packaging Levels */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opening Raw Water (L)</label>
            <input
              type="number"
              value={openingRawWater}
              onChange={(e) => setOpeningRawWater(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Closing Raw Water (L)</label>
            <input
              type="number"
              value={closingRawWater}
              onChange={(e) => setClosingRawWater(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opening Purified (L)</label>
            <input
              type="number"
              value={openingPurifiedWater}
              onChange={(e) => setOpeningPurifiedWater(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Closing Purified (L)</label>
            <input
              type="number"
              value={closingPurifiedWater}
              onChange={(e) => setClosingPurifiedWater(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
            />
          </div>
        </div>

        {/* Downtime */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Downtime (Minutes)</label>
            <input
              type="number"
              min="0"
              value={downtimeMinutes}
              onChange={(e) => setDowntimeMinutes(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Downtime Reason (if any)</label>
            <input
              type="text"
              placeholder="e.g. ECG Power trip, Sachet film roll change, Sealer heating delay"
              value={downtimeReason}
              onChange={(e) => setDowntimeReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
        >
          {isSubmitting ? "Recording Production..." : "SAVE SHIFT PRODUCTION & CREATE BATCH"}
        </button>
      </form>

      {/* ------------------------------------------------------------- */}
      {/* RECENT RUNS & BATCH TRACEABILITY TABLE                        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-sm text-slate-900">Recent Production Runs & Batches</h3>
          <span className="text-xs text-slate-500 font-mono">{runs.length} recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Run ID</th>
                <th className="p-3">Batch Number</th>
                <th className="p-3">Date & Shift</th>
                <th className="p-3 text-right">Produced</th>
                <th className="p-3 text-right">Rejects</th>
                <th className="p-3 text-right">Good Bags</th>
                <th className="p-3 text-right">Reject Rate</th>
                <th className="p-3 text-center">QC Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400">Loading runs...</td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400">No production runs recorded yet.</td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono text-slate-500">{r.runNumber}</td>
                    <td className="p-3 font-mono font-bold text-sky-700">
                      {r.batches[0]?.batchNumber || "—"}
                    </td>
                    <td className="p-3 text-slate-700">
                      {new Date(r.date).toLocaleDateString("en-GB")} ({r.shift === "MORNING_8_12" ? "Morning" : "Afternoon"})
                    </td>
                    <td className="p-3 text-right text-slate-700">{r.bagsProduced}</td>
                    <td className="p-3 text-right text-red-600 font-medium">{r.rejectedBags}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{r.goodBags}</td>
                    <td className="p-3 text-right font-semibold">
                      <span className={r.rejectRatePct > 3 ? "text-red-600" : "text-emerald-600"}>
                        {r.rejectRatePct}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {r.qcStatus}
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
