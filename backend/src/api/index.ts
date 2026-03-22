import express from "express";
import { config } from "../config.js";
import { errorHandlerMiddleware } from "./middleware/errorHandlerMiddleware.js";
import testRouter from "./routes/test.js";

const app = express();

app.use(express.json());

app.use("/test", testRouter);

app.use(errorHandlerMiddleware);

app.listen(config.port, () => {
  console.log(`API server is running on http://localhost:${config.port}`);
});
