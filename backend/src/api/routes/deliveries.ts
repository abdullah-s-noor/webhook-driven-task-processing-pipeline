import { Router } from "express";
import {
  getDeliveriesByPipelineHandler,
  getDeliveryAttemptsHandler,
} from "../handlers/deliveries.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.get("/pipeline/:pipelineId", asyncHandler(getDeliveriesByPipelineHandler));
router.get("/:deliveryId/attempts", asyncHandler(getDeliveryAttemptsHandler));

export default router;
