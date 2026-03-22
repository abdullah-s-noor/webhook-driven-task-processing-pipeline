import { Middleware } from "./types.js";
export const middlewareLogResponses: Middleware = (req, res, next) => {
    res.on("finish", () => {
        const statusCode = res.statusCode;
        if(statusCode > 299 || statusCode < 200)
            console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${statusCode}`)
    })
    next();
}
