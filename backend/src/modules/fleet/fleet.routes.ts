import { Router } from "express";
import {
  getVehicles,
  createVehicle,
  getTrips,
  recordTrip,
  recordFuel,
  recordMaintenance,
  createVehicleSchema,
  recordTripSchema,
  recordFuelSchema,
  recordMaintenanceSchema,
} from "./fleet.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validation.js";

const router = Router();

router.get("/vehicles", authenticate, getVehicles);
router.post("/vehicles", authenticate, validateBody(createVehicleSchema), createVehicle);

router.get("/trips", authenticate, getTrips);
router.post("/trips", authenticate, validateBody(recordTripSchema), recordTrip);

router.post("/fuel", authenticate, validateBody(recordFuelSchema), recordFuel);
router.post("/maintenance", authenticate, validateBody(recordMaintenanceSchema), recordMaintenance);

export const fleetRoutes = router;
