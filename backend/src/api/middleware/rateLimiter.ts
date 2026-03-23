import rateLimit from "express-rate-limit";

export const webhooksRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many webhook requests from this IP. Please try again later.",
  },
});
