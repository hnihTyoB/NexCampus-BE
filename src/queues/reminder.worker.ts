import { Worker, Job } from "bullmq";
import { envConfig } from "../config/env.config";
import { ReminderService } from "../modules/notifications/reminder.service";
import type { ReminderJobData } from "./reminder.queue";

async function processReminderJob(_job: Job<ReminderJobData>) {
  console.log("[ReminderWorker] Processing scheduled reminders job...");
  try {
    await ReminderService.runAllReminders();
    console.log("[ReminderWorker] Reminders job completed successfully.");
  } catch (error) {
    console.error("[ReminderWorker] Error in reminder job:", error);
    throw error;
  }
}

export function startReminderWorker() {
  const worker = new Worker<ReminderJobData>(
    "reminder-queue",
    processReminderJob,
    {
      connection: {
        host: envConfig.redis.host,
        port: envConfig.redis.port,
      },
      concurrency: 1, // Run 1 job at a time
    },
  );

  worker.on("completed", (job) => {
    console.log(`[ReminderWorker] Job ${job.id} completed successfully.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ReminderWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[ReminderWorker] Worker error:", err.message);
  });

  console.log(
    "[ReminderWorker] Worker started — listening for reminder jobs..."
  );
  return worker;
}
