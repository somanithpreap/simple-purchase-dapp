import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  purchaseHandler,
  submitPurchaseTxHandler,
  submitConfirmTxHandler,
  myOrdersHandler,
  sellerOrdersHandler,
} from "./controller.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);
ordersRouter.post("/", requireRole("CUSTOMER"), purchaseHandler);
ordersRouter.post("/:id/submit-tx", requireRole("CUSTOMER"), submitPurchaseTxHandler);
ordersRouter.post("/:id/submit-confirm-tx", requireRole("CUSTOMER"), submitConfirmTxHandler);
ordersRouter.get("/mine", requireRole("CUSTOMER"), myOrdersHandler);
ordersRouter.get("/seller", requireRole("SELLER"), sellerOrdersHandler);
