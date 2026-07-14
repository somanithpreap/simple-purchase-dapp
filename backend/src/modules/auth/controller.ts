import type { RequestHandler } from "express";
import { registerSchema, loginSchema } from "./schemas.js";
import * as authService from "./service.js";
import type { User } from "../../generated/prisma/client.js";

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    walletAddress: user.walletAddress,
  };
}

export const registerHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const { user, token } = await authService.register(input);
    res.status(201).json({ user: serializeUser(user), token });
  } catch (err) {
    next(err);
  }
};

export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const { user, token } = await authService.login(input);
    res.status(200).json({ user: serializeUser(user), token });
  } catch (err) {
    next(err);
  }
};

export const getBalanceHandler: RequestHandler = async (req, res, next) => {
  try {
    const balance = await authService.getWalletBalance(req.user!.sub);
    res.json(balance);
  } catch (err) {
    next(err);
  }
};
