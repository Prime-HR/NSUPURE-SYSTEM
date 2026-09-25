import React, { useState, useEffect, useRef } from "react";
import { Factory, CheckCircle, Clock, Droplets, AlertTriangle, Package, ShieldCheck, Send } from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { apiRequest } from "../../services/api.ts";

interface ProductionRun {
  id: string;
  version: number;
  voidedAt: string | null;
  voidReason: string | null;
  openingRawWaterLevel: number | null;
  closingRawWaterLevel: number | null;
  openingPurifiedWaterLevel: number | null;
  closingPurifiedWaterLevel: number | null;
  packagingUsedRolls: number;
  outerBagsUsed: number;
  downtimeReason: string | null;
  notes: string | null;
  runNumber: string;
  date: string;
  shift: string;
  startTime: string | null;
  endTime: string | null;
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
  const { hasRole } = useAuth();
  const submission = useRef<{ body: string; id: string } | null>(null);
  const canEdit = hasRole("OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR");
  const [editing, setEditing] = useState<ProductionRun | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showVoided, setShowVoided] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState<ProductionRun | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; action: string; timestamp: string; oldValue: string | null; newValue: string | null }> | null>(null);
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State (< 1 Minute Entry, 1 to 6 Hours Shifts)
  const [shift, setShift] = useState<string>("MORNING_6_12");
  const [startTime, setStartTime] = useState<string>("06:00");
  const [endTime, setEndTime] = useState<string>("12:00");
  const [machineHours, setMachineHours] = useState<number>(6.0);
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
  const [lastRecordedRun, setLastRecordedRun] = useState<{
    runNumber: string;
    date: string;
    batchNumber: string;
    goodBags: number;
    rejectedBags: number;
    machineHours: number;
    startTime: string;
    endTime: string;
    shift: string;
  } | null>(null);

  // Calculated variables
  const goodBags = Math.max(0, bagsProduced - rejectedBags);
  const rejectRate = bagsProduced > 0 ? Number(((rejectedBags / bagsProduced) * 100).toFixed(2)) : 0;
  const operatingHours = Math.max(0, machineHours - downtimeMinutes / 60);
  const productionPerHour = operatingHours > 0 ? Number((goodBags / operatingHours).toFixed(1)) : 0;

  const calculateHoursFromTimes = (start: string, end: string): number => {
    if (!start || !end) return 6.0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 6.0;
    let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    const hours = Number((diffMinutes / 60).toFixed(4));
    return hours > 0 && hours <= 24 ? hours : 6.0;
  };

  const handleShiftSelect = (type: string) => {
    if (type === "MORNING" || type === "MORNING_6_12") {
      setShift("MORNING_6_12");
      setStartTime("06:00");
      setEndTime("12:00");
      setMachineHours(6.0);
    } else if (type === "AFTERNOON" || type === "AFTERNOON_12_6") {
      setShift("AFTERNOON_12_6");
      setStartTime("12:00");
      setEndTime("18:00");
      setMachineHours(6.0);
    } else {
      setShift("CUSTOM_1_6");
    }
  };

  const sendShiftToWhatsApp = (runTarget?: any) => {
    const run = runTarget && typeof runTarget === "object" && "runNumber" in runTarget ? runTarget : lastRecordedRun;
    if (!run) return;
    const todayStr = new Date(run.date || date).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const shiftLabel =
      run.shift === "MORNING_6_12"
        ? "Morning Shift (6:00 AM – 12:00 PM)"
        : run.shift === "AFTERNOON_12_6"
        ? "Afternoon Shift (12:00 PM – 6:00 PM)"
        : `Custom Shift (${run.startTime} – ${run.endTime})`;

    const text = `🏭 *NSUPURE MINERAL WATER ENTERPRISE*
📍 *Adumasa Production Facility*
📅 *Date:* ${todayStr}

⚙️ *SHIFT PRODUCTION REPORT*
• *Batch No:* ${run.batchNumber}
• *Shift:* ${shiftLabel}
• *Start Time:* ${run.startTime}
• *End Time:* ${run.endTime}
• *Operating Hours:* ${run.machineHours} hrs
• *Good Bags:* ${run.goodBags} bags (Stock)
• *Rejected Bags:* ${run.rejectedBags} bags
• *Total Produced:* ${run.goodBags + run.rejectedBags} bags

_Sent directly from Nsupure Production Console to Central Admin (0248837001)_`;

    const url = `https://wa.me/233248837001?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ runs: ProductionRun[] }>(`/production/runs${showVoided ? "?includeVoided=true" : ""}`);
      if (res.data) {
        setRuns(res.data.runs);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [showVoided]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const body = JSON.stringify({
          date,
          ...(editing ? { expectedVersion: editing.version, reason } : {}),
          shift,
          startTime,
          endTime,
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
        });
      if (!submission.current || submission.current.body !== body) submission.current = { body, id: crypto.randomUUID() };
      const res = await apiRequest<{ run: ProductionRun; batch: { batchNumber: string } }>(editing ? `/production/runs/${editing.id}` : "/production/runs", {
        method: editing ? "PUT" : "POST", body,
        headers: editing ? {} : { "Idempotency-Key": submission.current.id },
      });

      if (res.data) {
        submission.current = null;
        setSuccessMessage(`${editing ? "Corrected" : "Logged"} ${goodBags} good bags. Batch: ${res.data.batch.batchNumber}`);
        setEditing(res.data.run); setReason("");
        setLastRecordedRun({
          runNumber: res.data.run.runNumber,
          date: res.data.run.date,
          batchNumber: res.data.batch.batchNumber,
          goodBags,
          rejectedBags,
          machineHours: res.data.run.machineHours,
          startTime,
          endTime,
          shift,
        });
        fetchRuns();
      }
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to record production run");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditing(null); setReason(""); setDate(new Date().toISOString().slice(0, 10));
    handleShiftSelect("MORNING_6_12"); setBagsProduced(0); setRejectedBags(0);
    setOpeningRawWater(0); setClosingRawWater(0); setOpeningPurifiedWater(0); setClosingPurifiedWater(0);
    setPackagingUsedRolls(0); setOuterBagsUsed(0); setDowntimeMinutes(0); setDowntimeReason(""); setNotes("");
    submission.current = null;
  };
  const beginEdit = (run: ProductionRun) => {
    setEditing(run); setDeleting(null); setReason(""); setErrorMessage(null); setSuccessMessage(null);
    setDate(run.date.slice(0, 10)); setShift(run.shift);
    setStartTime(run.startTime ? run.startTime.slice(11, 16) : "");
    setEndTime(run.endTime ? run.endTime.slice(11, 16) : "");
    setMachineHours(run.startTime && run.endTime ? (new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 3600000 : run.machineHours);
    setBagsProduced(run.bagsProduced); setRejectedBags(run.rejectedBags);
    setOpeningRawWater(run.openingRawWaterLevel ?? 0); setClosingRawWater(run.closingRawWaterLevel ?? 0);
    setOpeningPurifiedWater(run.openingPurifiedWaterLevel ?? 0); setClosingPurifiedWater(run.closingPurifiedWaterLevel ?? 0);
    setPackagingUsedRolls(run.packagingUsedRolls); setOuterBagsUsed(run.outerBagsUsed);
    setDowntimeMinutes(run.downtimeMinutes); setDowntimeReason(run.downtimeReason || ""); setNotes(run.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const deleteRun = async () => {
    if (!deleting) return;
    setIsSubmitting(true); setErrorMessage(null);
    try {
      await apiRequest(`/production/runs/${deleting.id}/${restoring ? "restore" : "void"}`, { method: "POST", body: JSON.stringify({ expectedVersion: deleting.version, reason }) });
      setSuccessMessage(restoring ? "Entry restored. Quality review is required before release." : "Entry deleted from active production. The original record and change history are retained.");
      setDeleting(null); setReason(""); setLastRecordedRun(null); await fetchRuns();
    } catch (error) { setErrorMessage((error as Error).message); }
    finally { setIsSubmitting(false); }
  };
  const viewHistory = async (run: ProductionRun) => {
    try {
      const response = await apiRequest<{ history: NonNullable<typeof history> }>(`/production/runs/${run.id}/history`);
      setHistory(response.data?.history || []);
    } catch (error) { setErrorMessage((error as Error).message); }
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

      {errorMessage && <div role="alert" className="p-4 rounded-xl bg-red-50 text-red-800 border border-red-200">{errorMessage}</div>}
      {deleting && <section className="bg-white border border-red-200 rounded-xl p-5 space-y-3" aria-label="Delete production entry">
        <h3 className="font-bold">{restoring ? "Restore" : "Delete"} {deleting.runNumber}?</h3>
        <p>{restoring ? "This restores the original quantities to active totals and requires a new quality review." : "This removes the entry from active totals. The original data remains in history. Entries linked to stock movements require reconciliation first."}</p>
        <label className="block">Reason for {restoring ? "restoration" : "deletion"}<input autoFocus maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="block w-full border rounded p-2" /></label>
        <button disabled={isSubmitting || reason.trim().length < 5} onClick={deleteRun} className="bg-red-700 text-white rounded p-3 disabled:opacity-50">{isSubmitting ? "Saving..." : restoring ? "Confirm restore" : "Confirm delete"}</button>
        <button onClick={() => { setDeleting(null); setReason(""); }} className="p-3">Cancel</button>
      </section>}
      {history && <section className="bg-white border rounded-xl p-5 space-y-3" aria-label="Production history">
        <h3 className="font-bold">Production change history</h3>
        <button onClick={() => setHistory(null)} className="p-2 border rounded">Close history</button>
        {history.length === 0 && <p>No change history recorded for this legacy entry.</p>}
        {history.map(item => <details key={item.id} className="border rounded p-3"><summary>{item.action} - {new Date(item.timestamp).toLocaleString()}</summary><pre className="overflow-auto text-xs whitespace-pre-wrap">{JSON.stringify({ before: item.oldValue ? JSON.parse(item.oldValue) : null, after: item.newValue ? JSON.parse(item.newValue) : null }, null, 2)}</pre></details>)}
      </section>}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          {lastRecordedRun && (
            <button
              type="button"
              onClick={sendShiftToWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-black shadow-sm transition shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              📲 Send Shift to WhatsApp (0248837001)
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1-MINUTE PRODUCTION LOGGING FORM (Section 25 & 82)            */}
      {/* ------------------------------------------------------------- */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <Clock className="w-4 h-4 text-slate-500" />
          {editing ? `Edit ${editing.runNumber}` : "Record Shift Production"}
        </h3>

        <label className="block text-sm font-semibold">Production date (Ghana time)<input type="date" required max={new Date().toISOString().slice(0, 10)} value={date} onChange={e => setDate(e.target.value)} className="block border rounded p-2" /></label>
        {editing && <label className="block text-sm font-semibold">Reason for correction<input required minLength={5} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="block w-full border rounded p-2" /></label>}
        {/* Shift Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Work Shift</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleShiftSelect("MORNING_6_12")}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition text-center ${
                shift === "MORNING_6_12"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              ☀️ Morning (6:00 AM – 12:00 PM)
            </button>
            <button
              type="button"
              onClick={() => handleShiftSelect("AFTERNOON_12_6")}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition text-center ${
                shift === "AFTERNOON_12_6"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              🌤️ Afternoon (12:00 PM – 6:00 PM)
            </button>
            <button
              type="button"
              onClick={() => handleShiftSelect("CUSTOM_1_6")}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition text-center ${
                shift === "CUSTOM_1_6"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              ⏱️ Custom / Overnight
            </button>
          </div>
        </div>

        {/* Start Time & End Time Recording */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Shift Start Time
            </label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => {
                const val = e.target.value;
                setStartTime(val);
                const hrs = calculateHoursFromTimes(val, endTime);
                setMachineHours(hrs);
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Shift End Time
            </label>
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => {
                const val = e.target.value;
                setEndTime(val);
                const hrs = calculateHoursFromTimes(startTime, val);
                setMachineHours(hrs);
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
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
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Shift duration (hours)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0.01"
              max="24"
              required
              value={machineHours}
              onChange={(e) => setMachineHours(parseFloat(e.target.value) || 6.0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-500 font-medium">Elapsed shift time; production rate excludes downtime</span>
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

        <div className="grid grid-cols-2 gap-3">
          <label>Film rolls used<input type="number" min="0" step="0.01" required value={packagingUsedRolls} onChange={e => setPackagingUsedRolls(Number(e.target.value))} className="block border rounded p-2 w-full" /></label>
          <label>Outer bags used<input type="number" min="0" step="1" required value={outerBagsUsed} onChange={e => setOuterBagsUsed(Number(e.target.value))} className="block border rounded p-2 w-full" /></label>
        </div>
        <label className="block">Production notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className="block border rounded p-2 w-full" /></label>
        {editing && <button type="button" onClick={resetForm} className="border rounded p-3">New entry / cancel edit</button>}
        <button
          type="submit"
          disabled={isSubmitting || !canEdit}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : editing ? "SAVE CORRECTION" : "SAVE SHIFT PRODUCTION & CREATE BATCH"}
        </button>
      </form>

      {/* ------------------------------------------------------------- */}
      {/* RECENT RUNS & BATCH TRACEABILITY TABLE                        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-sm text-slate-900">Recent Production Runs & Batches</h3>
          <label className="text-xs"><input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} /> Include deleted entries</label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Run ID</th>
                <th className="p-3">Batch Number</th>
                <th className="p-3">Date & Shift</th>
                <th className="p-3">Time Window</th>
                <th className="p-3 text-right">Hours</th>
                <th className="p-3 text-right">Produced</th>
                <th className="p-3 text-right">Rejects</th>
                <th className="p-3 text-right">Good Bags</th>
                <th className="p-3 text-right">Reject Rate</th>
                <th className="p-3 text-center">QC Status</th><th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-slate-400">Loading runs...</td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-slate-400">No production runs recorded yet.</td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono text-slate-500">{r.runNumber}</td>
                    <td className="p-3 font-mono font-bold text-sky-700">
                      {r.batches[0]?.batchNumber || "—"}
                    </td>
                    <td className="p-3 text-slate-700">
                      {new Date(r.date).toLocaleDateString("en-GB")}{" "}
                      <span className="font-semibold text-slate-900">
                        ({r.shift.includes("MORNING") ? "Morning" : r.shift.includes("AFTERNOON") ? "Afternoon" : "Custom"})
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-600">
                      {r.startTime && r.endTime ? (
                        <span>
                          {new Date(r.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                          {new Date(r.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-700">
                      {r.machineHours ? `${r.machineHours}h` : "—"}
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
                        {r.voidedAt ? "DELETED" : r.qcStatus}
                      </span>
                    </td>
                    <td className="p-3 space-x-2 whitespace-nowrap">
                      {canEdit && !r.voidedAt && <><button disabled={isSubmitting} onClick={() => beginEdit(r)} className="p-2 border rounded text-indigo-700">Edit</button><button disabled={isSubmitting} onClick={() => { setRestoring(false); setDeleting(r); setEditing(null); setReason(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="p-2 border rounded text-red-700">Delete</button></>}
                      {canEdit && r.voidedAt && <button onClick={() => { setRestoring(true); setDeleting(r); setEditing(null); setReason(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="p-2 border rounded text-emerald-700">Restore</button>}
                      {canEdit && <button onClick={() => viewHistory(r)} className="p-2 border rounded">History</button>}
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
