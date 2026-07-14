import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  createProductHandler,
  listProductsHandler,
  getProductHandler,
  updateStockHandler,
  updateProductHandler,
  deleteProductHandler,
} from "./controller.js";

export const productsRouter = Router();

productsRouter.get("/", listProductsHandler);
productsRouter.get("/:id", getProductHandler);
productsRouter.post("/", requireAuth, requireRole("SELLER"), createProductHandler);
productsRouter.patch("/:id/stock", requireAuth, requireRole("SELLER"), updateStockHandler);
productsRouter.patch("/:id", requireAuth, requireRole("SELLER"), updateProductHandler);
productsRouter.delete("/:id", requireAuth, requireRole("SELLER"), deleteProductHandler);
