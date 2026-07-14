import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requestNonceHandler, connectWalletHandler } from "./controller.js";

export const walletRouter = Router();

walletRouter.use(requireAuth);
walletRouter.post("/nonce", requestNonceHandler);
walletRouter.post("/connect", connectWalletHandler);
