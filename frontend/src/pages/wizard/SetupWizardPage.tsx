import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, Settings, Save, AlertCircle } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

export const SetupWizardPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Wizard Steps Data State
  const [formData, setFormData] = useState({
    companyName: "NSUPURE MINERAL WATER ENTERPRISE",
    businessType: "Sole Proprietorship",
    factoryLocation: "Adumasa, Juaben Constituency, Ashanti Region, Ghana",
    productionStartDate: "2025-12-21",
    rawWaterTankCapacity: 2000,
    purifiedWaterTankCapacity: 1000,
    mainProductName: "Nsupure 500ml Sachet Drinking Water",
    defaultPrice: 7.0,
    sachetsPerBag: 30,
    openingCashAmount: 500.0,
    openingInventoryRolls: 15.0,
    openingBoreholeAssetCost: 18000.0,
    openingMachineAssetCost: 35000.0,
    confirmInitialDebt: false,
    initialDebtAmount: 30000.0,
    initialDebtLender: "Private Business Setup Financing",
    primaryVehicleReg: "ABOBOYAA-01",
    primaryVehicleCapacity: 60,
  });

  const steps = [
    { num: 1, title: "Company Information" },
    { num: 2, title: "Factory & Water Storage" },
    { num: 3, title: "Product Configuration" },
    { num: 4, title: "Packaging Units" },
    { num: 5, title: "User Accounts" },
    { num: 6, title: "Role Permissions" },
    { num: 7, title: "Opening Cashbook Balance" },
    { num: 8, title: "Opening Inventory" },
    { num: 9, title: "Opening Plant Assets" },
    { num: 10, title: "Opening Liabilities & Debt" },
    { num: 11, title: "Initial Customers" },
    { num: 12, title: "Distribution Vehicles" },
  ];

  const fetchWizardStatus = async () => {
    try {
      const res = await apiRequest<{ stepsCompleted: Record<number, boolean> }>("/settings/wizard/status");
      if (res.data?.stepsCompleted) {
        setCompletedSteps(res.data.stepsCompleted);
      }
    } catch (err) {
      console.error("Failed to load wizard status", err);
    }
  };

  useEffect(() => {
    fetchWizardStatus();
  }, []);

  const handleSaveStep = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await apiRequest("/settings/wizard/step", {
        method: "POST",
        body: JSON.stringify({
          stepNumber: currentStep,
          stepName: steps[currentStep - 1].title,
          data: formData,
        }),
      });

      setCompletedSteps((prev) => ({ ...prev, [currentStep]: true }));
      setMessage(`Step ${currentStep} (${steps[currentStep - 1].title}) saved successfully.`);

      if (currentStep < 12) {
        setCurrentStep((prev) => prev + 1);
      }
    } catch (err) {
      alert((err as Error).message || "Failed to save wizard step");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-600" />
            12-Step Business Setup Wizard
          </h2>
          <p className="text-xs text-slate-500">
            Initial configuration for Nsupure Mineral Water Enterprise (Completed gradually)
          </p>
        </div>
        <div className="text-xs font-bold font-mono px-3 py-1 bg-sky-50 text-sky-700 rounded-full border border-sky-200">
          Step {currentStep} of 12
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Steps Progress Tracker */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        {steps.map((s) => (
          <button
            key={s.num}
            onClick={() => setCurrentStep(s.num)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition ${
              currentStep === s.num
                ? "bg-sky-600 text-white font-black shadow-sm"
                : completedSteps[s.num]
                ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="text-xs">{s.num}</span>
            {completedSteps[s.num] && currentStep !== s.num && (
              <CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* Step Content Container */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b pb-2">
          Step {currentStep}: {steps[currentStep - 1].title}
        </h3>

        {/* Step 1: Company Information */}
        {currentStep === 1 && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Business Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Business Legal Structure</label>
              <input
                type="text"
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Commercial Production Start Date</label>
              <input
                type="date"
                value={formData.productionStartDate}
                onChange={(e) => setFormData({ ...formData, productionStartDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono"
              />
            </div>
          </div>
        )}

        {/* Step 2: Factory & Water Storage */}
        {currentStep === 2 && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Factory Location</label>
              <input
                type="text"
                value={formData.factoryLocation}
                onChange={(e) => setFormData({ ...formData, factoryLocation: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Purified-Water Tank (Litres)</label>
                <input
                  type="number"
                  value={formData.purifiedWaterTankCapacity}
                  readOnly
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-600"
                />
                <span className="text-[10px] text-slate-400">Fixed at 1,000 Litres (Installed Tank)</span>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Raw-Water Tank Capacity (Litres)</label>
                <input
                  type="number"
                  value={formData.rawWaterTankCapacity}
                  onChange={(e) => setFormData({ ...formData, rawWaterTankCapacity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
                <span className="text-[10px] text-sky-600">Configurable by Administrator</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 & 4: Product & Units */}
        {(currentStep === 3 || currentStep === 4) && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Main Product Offering</label>
              <input
                type="text"
                value={formData.mainProductName}
                onChange={(e) => setFormData({ ...formData, mainProductName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Packaging Ratio</label>
                <input
                  type="text"
                  value="30 Sachets = 1 Bag"
                  readOnly
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Default Selling Price (GH₵)</label>
                <input
                  type="number"
                  step="0.50"
                  value={formData.defaultPrice}
                  onChange={(e) => setFormData({ ...formData, defaultPrice: parseFloat(e.target.value) || 7.0 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-emerald-700"
                />
                <span className="text-[10px] text-slate-400">Current factory price (Editable by management)</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Opening Cash */}
        {currentStep === 7 && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Enter initial cash in factory safe/till on first system go-live. Marked explicitly as OPENING BALANCE.
            </p>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Opening Cash (GH₵)</label>
              <input
                type="number"
                step="10"
                min="0"
                value={formData.openingCashAmount}
                onChange={(e) => setFormData({ ...formData, openingCashAmount: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-900 text-sm"
              />
            </div>
          </div>
        )}

        {/* Step 10: Opening Liabilities (GH₵30,000 Debt) */}
        {currentStep === 10 && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
              <p className="font-bold">Initial Known Debt: GH₵30,000.00</p>
              <p className="text-[11px] mt-0.5">
                Per Section 42, this should be entered as an initial business liability ONLY when management confirms the supporting details.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="confirmDebtCheck"
                checked={formData.confirmInitialDebt}
                onChange={(e) => setFormData({ ...formData, confirmInitialDebt: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="confirmDebtCheck" className="font-bold text-slate-800">
                Management confirms initial business liability of GH₵30,000.00
              </label>
            </div>

            {formData.confirmInitialDebt && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lender / Creditor Name</label>
                  <input
                    type="text"
                    value={formData.initialDebtLender}
                    onChange={(e) => setFormData({ ...formData, initialDebtLender: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Principal Liability (GH₵)</label>
                  <input
                    type="number"
                    value={formData.initialDebtAmount}
                    onChange={(e) => setFormData({ ...formData, initialDebtAmount: parseFloat(e.target.value) || 30000 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 12: Vehicles (Aboboyaa) */}
        {currentStep === 12 && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Primary Distribution Vehicle</label>
              <input
                type="text"
                value="Aboboyaa (Motorized Tricycle)"
                readOnly
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Registration / Fleet Code</label>
                <input
                  type="text"
                  value={formData.primaryVehicleReg}
                  onChange={(e) => setFormData({ ...formData, primaryVehicleReg: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Trip Capacity (Bags)</label>
                <input
                  type="number"
                  value={formData.primaryVehicleCapacity}
                  onChange={(e) => setFormData({ ...formData, primaryVehicleCapacity: parseInt(e.target.value) || 60 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Fallback description for other steps */}
        {![1, 2, 3, 4, 7, 10, 12].includes(currentStep) && (
          <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600">
            <p className="font-bold text-slate-800 mb-1">Configuration parameters established from system defaults.</p>
            <p>Click "Save Step & Continue" to confirm configuration for {steps[currentStep - 1].title}.</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => prev - 1)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveStep}
            className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : currentStep === 12 ? "Complete Wizard" : "Save Step & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};
