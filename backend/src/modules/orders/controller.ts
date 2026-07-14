import type { RequestHandler } from "express";
import { createOrderSchema, submitTxSchema } from "./schemas.js";
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
    const { order, sellerWalletAddress } = await orderService.purchase(req.user!.sub, input);
    res.status(201).json({ ...serializeOrder(order), sellerWalletAddress });
  } catch (err) {
    next(err);
  }
};

export const submitPurchaseTxHandler: RequestHandler = async (req, res, next) => {
  try {
    const orderId = parseOrderId(getParam(req.params.id));
    const { txHash } = submitTxSchema.parse(req.body);
    const order = await orderService.submitPurchaseTx(orderId, req.user!.sub, txHash);
    res.json(serializeOrder(order));
  } catch (err) {
    next(err);
  }
};

export const submitConfirmTxHandler: RequestHandler = async (req, res, next) => {
  try {
    const orderId = parseOrderId(getParam(req.params.id));
    const { txHash } = submitTxSchema.parse(req.body);
    const order = await orderService.submitConfirmTx(orderId, req.user!.sub, txHash);
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
