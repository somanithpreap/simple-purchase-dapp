import express from "express";
import cors from "cors";
import { authRouter } from "./modules/auth/routes.js";
import { productsRouter } from "./modules/products/routes.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { walletRouter } from "./modules/wallet/routes.js";
import { getContractAddress, getProvider } from "./blockchain/contract.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Public: lets the frontend construct its own ethers.Contract against the
  // MetaMask signer without hardcoding the deployed address/chain.
  app.get("/api/v1/contract-info", async (_req, res, next) => {
    try {
      const [address, network] = await Promise.all([getContractAddress(), getProvider().getNetwork()]);
      res.json({ address, chainId: Number(network.chainId) });
    } catch (err) {
      next(err);
    }
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/orders", ordersRouter);
  app.use("/api/v1/wallet", walletRouter);

  app.use(errorHandler);

  return app;
}
