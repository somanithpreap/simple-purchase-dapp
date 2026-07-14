import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { registerHandler, loginHandler, getBalanceHandler } from "./controller.js";

export const authRouter = Router();

authRouter.post("/register", registerHandler);
authRouter.post("/login", loginHandler);
authRouter.get("/me/balance", requireAuth, getBalanceHandler);
