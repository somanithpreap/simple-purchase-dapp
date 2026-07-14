import { HttpError } from "./httpError.js";

export function getParam(value: string | string[] | undefined): string {
  if (typeof value !== "string") {
    throw new HttpError("Invalid route parameter", 400);
  }
  return value;
}
