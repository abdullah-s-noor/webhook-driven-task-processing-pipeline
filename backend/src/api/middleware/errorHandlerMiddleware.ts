import { ErrorMiddleware } from "./types.js";
import { NotFoundError } from "../errors/notFoundError.js";
import { BadRequestError } from "../errors/badRequestError.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";
import { ForbiddenError } from "../errors/forbiddenError.js";
export const errorHandlerMiddleware: ErrorMiddleware = (err, req, res, next) => {
    console.error("An error occurred:", err.message);
    if(err instanceof NotFoundError)
        res.status(404).json({ error: err.message });
    else if(err instanceof BadRequestError)
        res.status(400).json({ error: err.message });
    else if(err instanceof UnauthorizedError)
        res.status(401).json({ error: err.message });
    else if(err instanceof ForbiddenError)
        res.status(403).json({ error: err.message });
    else res.status(500).json({ error: "Something went wrong on our end" });
};
