import { Worker, Job } from "bullmq";
import { envConfig } from "../config/env.config";
import { prisma } from "../database/prisma.client";
import { EmailService } from "../common/services/email.service";
import { DiscordService } from "../common/services/discord.service";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_LOG_STATUS,
} from "../common/constants/status.constant";
import type { NotificationJobData } from "./notification.queue";

async function processNotificationJob(job: Job<NotificationJobData>) {
  const {
    notificationId,
    userId,
    guestEmail,
    title,
    content,
    emailEnabled,
    discordEnabled,
  } = job.data;

  // Resolve recipient email
  let recipientEmail: string | null = guestEmail ?? null;
  if (emailEnabled && !recipientEmail && userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { email: true },
    });
    recipientEmail = user?.email ?? null;
  }

  // Send EMAIL
  if (emailEnabled && recipientEmail) {
    // Idempotency check: skip sending if an email log with SUCCESS status already exists
    const existingLog = await prisma.notificationLog.findFirst({
      where: {
        notificationId,
        channel: NOTIFICATION_CHANNEL.EMAIL,
        status: NOTIFICATION_LOG_STATUS.SUCCESS,
      },
    });

    if (existingLog) {
      console.log(
        `[NotificationWorker] Notification ${notificationId} email already sent successfully. Skipping retry.`,
      );
      return;
    }

    const finalSubject = job.data.emailSubject || title;
    const finalContent = job.data.emailContent || content;
    const success = await EmailService.sendMail(recipientEmail, finalSubject, finalContent);
    await prisma.notificationLog.create({
      data: {
        notificationId,
        channel: NOTIFICATION_CHANNEL.EMAIL,
        status: success
          ? NOTIFICATION_LOG_STATUS.SUCCESS
          : NOTIFICATION_LOG_STATUS.FAILED,
      },
    });
  }

  // Send DISCORD
  if (discordEnabled) {
    const success = await DiscordService.sendMessage(title, content);
    await prisma.notificationLog.create({
      data: {
        notificationId,
        channel: NOTIFICATION_CHANNEL.DISCORD,
        status: success
          ? NOTIFICATION_LOG_STATUS.SUCCESS
          : NOTIFICATION_LOG_STATUS.FAILED,
      },
    });
  }
}

export function startNotificationWorker() {
  const worker = new Worker<NotificationJobData>(
    "notification-queue",
    processNotificationJob,
    {
      connection: {
        host: envConfig.redis.host,
        port: envConfig.redis.port,
      },
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    console.log(
      `[NotificationWorker] Job ${job.id} completed for notification ${job.data.notificationId}`,
    );
  });

  worker.on("failed", (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[NotificationWorker] Worker error:", err.message);
  });

  console.log(
    "[NotificationWorker] Worker started — listening for notification jobs...",
  );
  return worker;
}
