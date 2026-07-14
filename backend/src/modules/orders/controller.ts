import type { RequestHandler } from "express";
import { createOrderSchema } from "./schemas.js";
import * as orderService from "./service.js";
import { serializeOrder } from "../../utils/serialize.js";
import { HttpError } from "../../utils/httpError.js";
import { getParam } from "../../utils/params.js";

function parseOrderId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError("Invalid order id", 400);
  }
  return id;
}

export const purchaseHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = createOrderSchema.parse(req.body);
    const order = await orderService.purchase(req.user!.sub, input);
    res.status(201).json(serializeOrder(order));
  } catch (err) {
    next(err);
  }
};

export const confirmDeliveryHandler: RequestHandler = async (req, res, next) => {
  try {
    const orderId = parseOrderId(getParam(req.params.id));
    const order = await orderService.confirmDelivery(orderId, req.user!.sub);
    res.json(serializeOrder(order));
  } catch (err) {
    next(err);
  }
};

export const myOrdersHandler: RequestHandler = async (req, res, next) => {
  try {
    const orders = await orderService.listBuyerOrders(req.user!.sub);
    res.json(orders.map(serializeOrder));
  } catch (err) {
    next(err);
  }
};

export const sellerOrdersHandler: RequestHandler = async (req, res, next) => {
  try {
    const orders = await orderService.listSellerOrders(req.user!.sub);
    res.json(orders.map(serializeOrder));
  } catch (err) {
    next(err);
  }
};
