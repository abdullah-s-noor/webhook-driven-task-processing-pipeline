import { startDeliveryPoller } from "./delivery/poller.js";
import { startJobPoller } from "./job/poller.js";

function startWorker() {
  console.log("Worker started");
  startJobPoller();
  startDeliveryPoller();
}

startWorker();
