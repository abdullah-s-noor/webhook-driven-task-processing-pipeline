import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    message: "Backend is working",
  });
});

export default router;
