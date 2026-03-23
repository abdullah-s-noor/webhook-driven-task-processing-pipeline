import type { Request, RequestHandler } from "express";
import { verifySignature as verifyHmacSignature } from "../../utils/hmac.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";

type SecretResolver = (req: Request) => string;

function getRequestPayload(req: Request): string {
  if (typeof req.rawBody === "string") {
    return req.rawBody;
  }

  return JSON.stringify(req.body ?? {});
}

export function verifySignature(secretResolver: SecretResolver): RequestHandler {
  return (req, _res, next) => {
    const signature = req.header("X-Signature");

    if (!signature) {
      return next(new UnauthorizedError("Missing X-Signature header"));
    }

    const secret = secretResolver(req);

    if (!secret) {
      return next(new UnauthorizedError("Missing signing secret"));
    }

    const isValid = verifyHmacSignature(getRequestPayload(req), secret, signature);

    if (!isValid) {
      return next(new UnauthorizedError("Invalid signature"));
    }

    next();
  };
}
