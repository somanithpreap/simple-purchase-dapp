import express from "express";
import cors from "cors";
import { authRouter } from "./modules/auth/routes.js";
import { productsRouter } from "./modules/products/routes.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/orders", ordersRouter);

  app.use(errorHandler);

  return app;
}
