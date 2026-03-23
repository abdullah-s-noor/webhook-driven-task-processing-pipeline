import { Router } from "express";
import {
  createSubscriberHandler,
  deleteSubscriberHandler,
  getSubscriberByIdHandler,
  getSubscribersHandler,
  updateSubscriberHandler,
} from "../handlers/subscribers.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.post("/", asyncHandler(createSubscriberHandler));
router.get("/pipeline/:pipelineId", asyncHandler(getSubscribersHandler));
router.get("/:id", asyncHandler(getSubscriberByIdHandler));
router.put("/:id", asyncHandler(updateSubscriberHandler));
router.delete("/:id", asyncHandler(deleteSubscriberHandler));

export default router;
