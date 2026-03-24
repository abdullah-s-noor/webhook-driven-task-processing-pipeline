import cors from "cors";
import express from "express";
import { config } from "../config.js";
import { errorHandlerMiddleware } from "./middleware/errorHandlerMiddleware.js";
import authRouter from "./routes/auth.js";
import pipelinesRouter from "./routes/pipelines.js";
import pipelineStepsRouter from "./routes/pipeline-steps.js";
import subscribersRouter from "./routes/subscribers.js";
import jobsRouter from "./routes/jobs.js";
import deliveriesRouter from "./routes/deliveries.js";
import testRouter from "./routes/test.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);
app.use("/pipelines", pipelinesRouter);
app.use("/pipeline-steps", pipelineStepsRouter);
app.use("/subscribers", subscribersRouter);
app.use("/jobs", jobsRouter);
app.use("/deliveries", deliveriesRouter);
app.use("/test", testRouter);

app.use(errorHandlerMiddleware);

app.listen(config.port, () => {
    console.log(`API server is running on http://localhost:${config.port}`);
});
