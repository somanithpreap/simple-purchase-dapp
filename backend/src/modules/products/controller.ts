import type { RequestHandler } from "express";
import {
  createProductSchema,
  updateStockSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from "./schemas.js";
import * as productService from "./service.js";
import { serializeProduct } from "../../utils/serialize.js";
import { getParam } from "../../utils/params.js";

export const createProductHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = createProductSchema.parse(req.body);
    const product = await productService.createProduct(req.user!.sub, input);
    res.status(201).json(serializeProduct(product));
  } catch (err) {
    next(err);
  }
};

export const listProductsHandler: RequestHandler = async (req, res, next) => {
  try {
    const query = listProductsQuerySchema.parse(req.query);
    const products = await productService.listProducts(query);
    res.json(products.map(serializeProduct));
  } catch (err) {
    next(err);
  }
};

export const getProductHandler: RequestHandler = async (req, res, next) => {
  try {
    const product = await productService.getProduct(getParam(req.params.id));
    res.json(serializeProduct(product));
  } catch (err) {
    next(err);
  }
};

export const updateStockHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = updateStockSchema.parse(req.body);
    const product = await productService.updateStock(getParam(req.params.id), req.user!.sub, input);
    res.json(serializeProduct(product));
  } catch (err) {
    next(err);
  }
};

export const updateProductHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = updateProductSchema.parse(req.body);
    const product = await productService.updateProduct(getParam(req.params.id), req.user!.sub, input);
    res.json(serializeProduct(product));
  } catch (err) {
    next(err);
  }
};
