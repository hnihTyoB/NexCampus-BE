import { Worker, Job, WorkerOptions } from "bullmq";
import { getRedisConnectionOptions } from "../../config/redis.config";
import { envConfig } from "../../config/env.config";
import { MailService } from "../../common/services/mail.service";
import {
  EmailJobData,
  QUEUE_NAMES,
} from "../index";
import { renderEmailTemplate } from "../templates/email-templates";

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test")) ||
  process.env.npm_lifecycle_event === "test";

let emailWorkerInstance: Worker<EmailJobData> | undefined;
const mailService = new MailService();

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const startTime = Date.now();
  const { type, to, data } = job.data;

  // Log job start without leaking sensitive parameters (passwords, tokens)
  console.log(
    `[EmailWorker] Processing job #${job.id} (name: ${job.name}, type: ${type}) to recipient: ${to}`,
  );

  try {
    const rendered = renderEmailTemplate(type, data);
    const subject = job.data.subject || rendered.subject;

    await mailService.sendRaw(to, subject, rendered.html);

    const duration = Date.now() - startTime;
    console.log(
      `[EmailWorker] ✅ Job #${job.id} completed successfully in ${duration}ms (type: ${type})`,
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `[EmailWorker] ❌ Job #${job.id} failed after ${duration}ms:`,
      error?.message || error,
    );
    throw error; // Ném lỗi để BullMQ kích hoạt cơ chế retry backoff
  }
}

export function startEmailWorker(): Worker<EmailJobData> | undefined {
  if (isTestEnv || !envConfig.redis.enabled) {
    console.log("[EmailWorker] Skipped starting worker in test/offline environment.");
    return undefined;
  }

  if (emailWorkerInstance) {
    return emailWorkerInstance;
  }

  const workerOptions: WorkerOptions = {
    connection: getRedisConnectionOptions() as any,
    concurrency: 5,
  };

  emailWorkerInstance = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    processEmailJob,
    workerOptions,
  );

  emailWorkerInstance.on("completed", (job) => {
    console.log(`[EmailWorker] Job #${job.id} [${job.name}] has been completed.`);
  });

  emailWorkerInstance.on("failed", (job, err) => {
    console.warn(
      `[EmailWorker] Job #${job?.id} [${job?.name}] failed (attempt ${job?.attemptsMade}): ${err.message}`,
    );
  });

  emailWorkerInstance.on("error", (err) => {
    if (envConfig.nodeEnv !== "production") {
      console.warn("[EmailWorker] Worker connection issue:", err.message);
    }
  });

  console.log("[EmailWorker] Worker started and listening on email-queue");
  return emailWorkerInstance;
}

export async function stopEmailWorker(): Promise<void> {
  if (emailWorkerInstance) {
    await emailWorkerInstance.close().catch(() => {});
    emailWorkerInstance = undefined;
    console.log("[EmailWorker] Worker stopped cleanly.");
  }
}
