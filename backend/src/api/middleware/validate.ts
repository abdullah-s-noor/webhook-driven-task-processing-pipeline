import type { NextFunction, Request, RequestHandler, Response } from "express";
import { BadRequestError } from "../errors/badRequestError.js";

type Validator = (value: unknown) => unknown;

type ValidationSchemas = {
  body?: Validator;
  query?: Validator;
  params?: Validator;
};

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body(req.body);
      if (schemas.query) req.query = schemas.query(req.query) as Request["query"];
      if (schemas.params) req.params = schemas.params(req.params) as Request["params"];

      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Validation failed";
      next(new BadRequestError(message));
    }
  };
}
