import React, { useState, useEffect } from "react";
import { Car, Plus, Fuel, Wrench, Navigation, Gauge } from "lucide-react";
import { apiRequest } from "../../services/api.ts";

interface Vehicle {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  makeModel: string | null;
  currentOdometer: number;
  status: string;
}

interface Trip {
  id: string;
  tripDate: string;
  startOdometer: number;
  endOdometer: number;
  distanceKm: number;
  bagsCarried: number;
  bagsDelivered: number;
  fuelCost: number;
  fuelCostPerKm: number;
  deliveryCostPerBag: number;
  vehicle: { registrationNumber: string };
}

export const FleetPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  // Record Trip Form State
  const [showTripModal, setShowTripModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [startOdo, setStartOdo] = useState(100.0);
  const [endOdo, setEndOdo] = useState(125.0);
  const [bagsCarried, setBagsCarried] = useState(60);
  const [bagsDelivered, setBagsDelivered] = useState(60);
  const [fuelCost, setFuelCost] = useState(50.0);

  // Fuel Log State
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [fuelLitres, setFuelLitres] = useState(4.5);
  const [fuelPricePerLitre, setFuelPricePerLitre] = useState(13.5);

  const fetchFleet = async () => {
    try {
      setLoading(true);
      const [vehRes, tripRes] = await Promise.all([
        apiRequest<{ vehicles: Vehicle[] }>("/fleet/vehicles"),
        apiRequest<{ trips: Trip[] }>("/fleet/trips"),
      ]);
      if (vehRes.data) {
        setVehicles(vehRes.data.vehicles);
        if (vehRes.data.vehicles[0]) {
          setSelectedVehicleId(vehRes.data.vehicles[0].id);
          setStartOdo(vehRes.data.vehicles[0].currentOdometer);
          setEndOdo(vehRes.data.vehicles[0].currentOdometer + 25.0);
        }
      }
      if (tripRes.data) setTrips(tripRes.data.trips);
    } catch (err) {
      console.error("Failed to load fleet", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const handleRecordTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/fleet/trips", {
        method: "POST",
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
          startOdometer: startOdo,
          endOdometer: endOdo,
          bagsCarried,
          bagsDelivered,
          fuelCost,
        }),
      });
      setShowTripModal(false);
      fetchFleet();
    } catch (err) {
      alert((err as Error).message || "Failed to log trip");
    }
  };

  const handleRecordFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/fleet/fuel", {
        method: "POST",
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
          fuelType: "PETROL",
          litres: fuelLitres,
          pricePerLitre: fuelPricePerLitre,
        }),
      });
      setShowFuelModal(false);
      fetchFleet();
    } catch (err) {
      alert((err as Error).message || "Failed to log fuel");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Car className="w-5 h-5 text-sky-600" />
            Tricycle Fleet & Trip Sheets
          </h2>
          <p className="text-xs text-slate-500">
            Aboboyaa motorized tricycles, odometer distance, and fuel cost tracking
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFuelModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition"
          >
            <Fuel className="w-4 h-4 text-amber-600" /> Log Fuel
          </button>
          <button
            onClick={() => setShowTripModal(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Record Trip
          </button>
        </div>
      </div>

      {/* Vehicles Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {vehicles.map((v) => (
          <div key={v.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800 uppercase">
                  {v.vehicleType}
                </span>
                <h3 className="font-black text-base text-slate-900 mt-1">{v.registrationNumber}</h3>
                <p className="text-xs text-slate-500">{v.makeModel || "Motorized Tricycle"}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {v.status}
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-slate-400" /> Odometer
              </span>
              <span className="font-mono font-bold text-slate-900">{v.currentOdometer.toFixed(1)} km</span>
            </div>
          </div>
        ))}
      </div>

      {/* Trip Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-sm text-slate-900">Recorded Vehicle Trips</h3>
          <span className="text-xs text-slate-500 font-mono">{trips.length} trips</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3 text-right">Distance</th>
                <th className="p-3 text-right">Bags Delivered</th>
                <th className="p-3 text-right">Fuel Cost</th>
                <th className="p-3 text-right">Fuel Cost / km</th>
                <th className="p-3 text-right">Delivery / Bag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">No trips logged yet.</td>
                </tr>
              ) : (
                trips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 text-slate-600">{new Date(t.tripDate).toLocaleDateString("en-GB")}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{t.vehicle.registrationNumber}</td>
                    <td className="p-3 text-right font-medium">{t.distanceKm} km</td>
                    <td className="p-3 text-right font-bold text-teal-700">{t.bagsDelivered} bags</td>
                    <td className="p-3 text-right text-slate-800">GH₵{t.fuelCost.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-slate-600">GH₵{t.fuelCostPerKm.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold text-sky-700">GH₵{t.deliveryCostPerBag.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Trip Modal */}
      {showTripModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="font-black text-base text-slate-900 mb-3">Record Trip Sheet</h3>
            <form onSubmit={handleRecordTrip} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Vehicle</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} ({v.vehicleType})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Odometer (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={startOdo}
                    onChange={(e) => setStartOdo(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Odometer (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={endOdo}
                    onChange={(e) => setEndOdo(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bags Carried</label>
                  <input
                    type="number"
                    required
                    value={bagsCarried}
                    onChange={(e) => setBagsCarried(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bags Delivered</label>
                  <input
                    type="number"
                    required
                    value={bagsDelivered}
                    onChange={(e) => setBagsDelivered(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Trip Fuel Cost (GH₵)</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={fuelCost}
                  onChange={(e) => setFuelCost(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl"
                >
                  Save Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Fuel Modal */}
      {showFuelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="font-black text-base text-slate-900 mb-3">Log Fuel Purchase</h3>
            <form onSubmit={handleRecordFuel} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Litres</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={fuelLitres}
                  onChange={(e) => setFuelLitres(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Price per Litre (GH₵)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={fuelPricePerLitre}
                  onChange={(e) => setFuelPricePerLitre(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center font-bold">
                <span>Total Fuel Cost:</span>
                <span className="text-emerald-700 text-sm font-black">
                  GH₵{(fuelLitres * fuelPricePerLitre).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFuelModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl"
                >
                  Save Fuel Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
