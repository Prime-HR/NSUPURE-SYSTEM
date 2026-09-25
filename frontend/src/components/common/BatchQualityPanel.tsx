import React, { useEffect, useState } from "react";
import { apiRequest } from "../../services/api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
const types = ["MICROBIOLOGICAL", "PHYSICOCHEMICAL", "PH", "NET_VOLUME", "CONDUCTIVITY", "OTHER"];
interface Batch { id: string; batchNumber: string; qcStatus: string; }
export function BatchQualityPanel() {
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [testType, setTestType] = useState("PH");
  const [parameter, setParameter] = useState("");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState("");
  const [passFail, setPassFail] = useState("");
  const [reason, setReason] = useState("");
  const [required, setRequired] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const canReview = hasRole("OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR");
  const canConfigure = hasRole("OWNER", "ADMINISTRATOR");
  const refresh = async () => {
    const [batchResponse, settings] = await Promise.all([apiRequest<{ batches: Batch[] }>("/production/batches"), apiRequest<{ settings: Record<string, string> }>("/settings")]);
    setBatches(batchResponse.data?.batches || []);
    setRequired((settings.data?.settings.qc_required_test_types || "").split(",").filter(Boolean));
  };
  useEffect(() => { refresh().catch(error => setMessage(error.message)); }, []);
  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage("");
    try { await action(); await refresh(); setMessage(success); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="bg-white p-5 border rounded-2xl space-y-4">
    <h3 className="font-bold">Batch quality review</h3>
    <p className="text-sm text-slate-600">New batches await review. Management must select the required test types for the approved factory quality procedure. A release records the reviewer and evidence; it is not a regulatory certification.</p>
    {message && <p role="status" className="bg-slate-100 rounded p-3">{message}</p>}
    {canConfigure && <details><summary className="cursor-pointer font-semibold">Required test types</summary>
      <div className="flex flex-wrap gap-3 py-3">{types.map(type => <label key={type}><input type="checkbox" checked={required.includes(type)} onChange={event => setRequired(event.target.checked ? [...required, type] : required.filter(value => value !== type))} /> {type}</label>)}</div>
      <button disabled={busy || !required.length} onClick={() => act(() => apiRequest("/settings", { method: "PUT", body: JSON.stringify({ settings: { qc_required_test_types: required.join(",") } }) }), "Quality procedure saved.")} className="border rounded p-2 disabled:opacity-50">Save required tests</button>
    </details>}
    <label className="block">Production batch<select required value={batchId} onChange={event => setBatchId(event.target.value)} className="block border rounded p-2 w-full"><option value="">Select batch</option>{batches.map(batch => <option key={batch.id} value={batch.id}>{batch.batchNumber} ({batch.qcStatus})</option>)}</select></label>
    {canReview && <>
      <form className="grid sm:grid-cols-2 gap-3" onSubmit={event => { event.preventDefault(); act(() => apiRequest("/quality/tests", { method: "POST", body: JSON.stringify({ batchId, testType, parameter, specificationReference: reference, result, passFail }) }), "Test recorded. Batch requires review before release."); }}>
        <label>Test type<select value={testType} onChange={event => setTestType(event.target.value)} className="block border rounded p-2 w-full">{types.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Parameter<input required minLength={2} value={parameter} onChange={event => setParameter(event.target.value)} className="block border rounded p-2 w-full" /></label>
        <label>Approved specification reference<input required minLength={2} value={reference} onChange={event => setReference(event.target.value)} className="block border rounded p-2 w-full" /></label>
        <label>Measured result<input required value={result} onChange={event => setResult(event.target.value)} className="block border rounded p-2 w-full" /></label>
        <label>Assessment<select required value={passFail} onChange={event => setPassFail(event.target.value)} className="block border rounded p-2 w-full"><option value="">Choose assessment</option><option value="PASS">Pass</option><option value="FAIL">Fail / quarantine</option></select></label>
        <button disabled={busy || !batchId} className="bg-indigo-700 text-white rounded p-3 disabled:opacity-50">Record test</button>
      </form>
      <form onSubmit={event => { event.preventDefault(); act(() => apiRequest(`/quality/batches/${batchId}/release`, { method: "POST", body: JSON.stringify({ reason }) }), "Batch release approved and recorded in history."); }} className="border-t pt-3 space-y-2">
        <label className="block">Release review notes<textarea required minLength={5} value={reason} onChange={event => setReason(event.target.value)} className="block border rounded p-2 w-full" /></label>
        <button disabled={busy || !batchId || !required.length} className="bg-emerald-700 text-white rounded p-3 disabled:opacity-50">Approve batch release</button>
      </form>
    </>}
  </section>;
}
