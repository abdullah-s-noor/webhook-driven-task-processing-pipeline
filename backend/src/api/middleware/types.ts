import { NextFunction } from "express";
import { Request, Response } from "express";
export type Middleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => void;
export type ErrorMiddleware = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => void;