import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { Role } from "../generated/prisma/enums.js";

export interface AuthPayload {
  sub: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
