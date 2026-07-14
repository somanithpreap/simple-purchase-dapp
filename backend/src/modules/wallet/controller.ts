import type { RequestHandler } from "express";
import { connectWalletSchema } from "./schemas.js";
import * as walletService from "./service.js";

export const requestNonceHandler: RequestHandler = async (req, res, next) => {
  try {
    const result = await walletService.requestNonce(req.user!.sub);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const connectWalletHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = connectWalletSchema.parse(req.body);
    const user = await walletService.connectWallet(req.user!.sub, input);
    res.json({ walletAddress: user.walletAddress });
  } catch (err) {
    next(err);
  }
};
