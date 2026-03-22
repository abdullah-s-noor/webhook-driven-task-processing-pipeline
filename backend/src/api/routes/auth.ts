import { Router } from "express";
import {
  loginHandler,
  logoutHandler,
  registerHandler,
} from "../handlers/auth.js";

const router = Router();

router.post("/register", registerHandler);
router.post("/login", loginHandler);
router.post("/logout", logoutHandler);

export default router;
