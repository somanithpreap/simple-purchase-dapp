import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  purchaseHandler,
  confirmDeliveryHandler,
  myOrdersHandler,
  sellerOrdersHandler,
} from "./controller.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);
ordersRouter.post("/", requireRole("CUSTOMER"), purchaseHandler);
ordersRouter.post("/:id/confirm-delivery", requireRole("CUSTOMER"), confirmDeliveryHandler);
ordersRouter.get("/mine", requireRole("CUSTOMER"), myOrdersHandler);
ordersRouter.get("/seller", requireRole("SELLER"), sellerOrdersHandler);
