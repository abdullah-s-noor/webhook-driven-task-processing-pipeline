import { Router } from "express";
import {
  createPipelineHandler,
  deletePipelineHandler,
  getPipelineByIdHandler,
  getPipelinesHandler,
} from "../handlers/pipelines.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.use(authenticate);

router.post("/", asyncHandler(createPipelineHandler));
router.get("/", asyncHandler(getPipelinesHandler));
router.get("/:id", asyncHandler(getPipelineByIdHandler));
router.delete("/:id", asyncHandler(deletePipelineHandler));

export default router;
