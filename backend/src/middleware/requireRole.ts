import type { RequestHandler } from "express";
import type { Role } from "../generated/prisma/enums.js";

export function requireRole(role: Role): RequestHandler {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: `Requires ${role} role` });
      return;
    }
    next();
  };
}
