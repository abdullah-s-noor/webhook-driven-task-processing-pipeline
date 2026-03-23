import { Router } from "express";
import {
  createPipelineStepHandler,
  deletePipelineStepHandler,
  getPipelineStepByIdHandler,
  getPipelineStepsHandler,
  updatePipelineStepHandler,
} from "../handlers/pipeline-steps.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.post("/", asyncHandler(createPipelineStepHandler));
router.get("/pipeline/:pipelineId", asyncHandler(getPipelineStepsHandler));
router.get("/:id", asyncHandler(getPipelineStepByIdHandler));
router.put("/:id", asyncHandler(updatePipelineStepHandler));
router.delete("/:id", asyncHandler(deletePipelineStepHandler));

export default router;
