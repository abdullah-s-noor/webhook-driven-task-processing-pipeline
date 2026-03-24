import { Router } from "express";
import {
  createJobHandler,
  getJobByIdHandler,
  getJobsByPipelineHandler,
} from "../handlers/jobs.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.post("/", asyncHandler(createJobHandler));
router.get("/pipeline/:pipelineId", asyncHandler(getJobsByPipelineHandler));
router.get("/:id", asyncHandler(getJobByIdHandler));

export default router;
