import { config } from "../../config.js";
import { findPending } from "../../db/queries/jobs.js";
import { withAdvisoryLock } from "../concurrency/lock.js";
import { processJob } from "./processor.js";

let isPolling = false;

async function pollOnce(): Promise<void> {
  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    const jobs = await findPending(10);

    for (const job of jobs) {
      await withAdvisoryLock("job", job.id, async () => {
        await processJob(job);
      });
    }
  } catch (error) {
    console.error("Job poller error:", error);
  } finally {
    isPolling = false;
  }
}

export function startJobPoller(): void {
  console.log("Job poller started");
  void pollOnce();

  setInterval(() => {
    void pollOnce();
  }, config.workerPollIntervalMs);
}
