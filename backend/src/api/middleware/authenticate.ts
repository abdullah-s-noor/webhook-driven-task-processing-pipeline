import jwt, { TokenExpiredError } from "jsonwebtoken";
import { config } from "../../config.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";
import type { Middleware } from "./types.js";
import type { AuthenticatedUser } from "../../types/user.js";

interface JwtPayload extends AuthenticatedUser {
  iat?: number;
  exp?: number;
}

export const authenticate: Middleware = (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing bearer token"));
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return next(new UnauthorizedError("Missing bearer token"));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = {
      id: payload.id,
      email: payload.email,
    };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(new UnauthorizedError("Token expired"));
    }

    return next(new UnauthorizedError("Invalid token"));
  }
};
