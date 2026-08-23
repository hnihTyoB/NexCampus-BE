import { prisma } from '../../database/prisma.client';
import { envConfig } from '../../config/env.config';
import { MailService } from '../services/mail.service';
import { EmailTemplateService } from '../services/email-template.service';
import { EMAIL_STATUS, EMAIL_MAX_ATTEMPTS, EmailTemplateKey } from '../constants/notification.constant';

const BATCH_SIZE = 20;

export class EmailWorker {
  private readonly mailService = new MailService();
  private readonly templateService = new EmailTemplateService();
  private intervalId?: ReturnType<typeof setInterval>;
  private isRunning = false;

  start(): void {
    if (!envConfig.notification.workerEnabled) {
      console.log('[EmailWorker] Disabled (NOTIFICATION_WORKER_ENABLED=false)');
      return;
    }

    const interval = envConfig.notification.workerIntervalMs;
    console.log(`[EmailWorker] Started — polling every ${interval / 1000}s`);

    // Chạy ngay lần đầu
    this.process();

    this.intervalId = setInterval(() => {
      this.process();
    }, interval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[EmailWorker] Stopped');
    }
  }

  private async process(): Promise<void> {
    if (this.isRunning) return; // Tránh chạy đồng thời nếu job trước chưa xong
    this.isRunning = true;

    try {
      const pending = await prisma.emailNotification.findMany({
        where: {
          status: EMAIL_STATUS.PENDING,
          attempts: { lt: EMAIL_MAX_ATTEMPTS },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (pending.length === 0) {
        this.isRunning = false;
        return;
      }

      const pendingIds = pending.map((p) => p.id);
      await prisma.emailNotification.updateMany({
        where: {
          id: { in: pendingIds },
          status: EMAIL_STATUS.PENDING,
        },
        data: {
          status: EMAIL_STATUS.PROCESSING,
        },
      });

      console.log(`[EmailWorker] Processing ${pending.length} pending email(s)`);

      await Promise.allSettled(
        pending.map((record) => this.sendOne(record)),
      );
    } catch (error) {
      console.error('[EmailWorker] Unexpected error during processing:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async sendOne(record: {
    id: string;
    toEmail: string;
    subject: string;
    templateKey: string;
    templateData: unknown;
    attempts: number;
  }): Promise<void> {
    try {
      const { html, subject } = await this.templateService.renderAsync(
        record.templateKey,
        record.templateData as Record<string, unknown>,
      );

      await this.mailService.sendRaw(record.toEmail, subject || record.subject, html);

      await prisma.emailNotification.update({
        where: { id: record.id },
        data: {
          status: EMAIL_STATUS.SENT,
          sentAt: new Date(),
          attempts: record.attempts + 1,
          lastError: null,
        },
      });

      console.log(`[EmailWorker] ✅ Sent email ${record.id} to ${record.toEmail}`);
    } catch (error: any) {
      const newAttempts = record.attempts + 1;
      const newStatus = newAttempts >= EMAIL_MAX_ATTEMPTS ? EMAIL_STATUS.FAILED : EMAIL_STATUS.PENDING;

      await prisma.emailNotification.update({
        where: { id: record.id },
        data: {
          status: newStatus,
          attempts: newAttempts,
          lastError: error?.message ?? String(error),
        },
      }).catch(() => {/* ignore update failure */});

      console.error(
        `[EmailWorker] ❌ Failed email ${record.id} (attempt ${newAttempts}/${EMAIL_MAX_ATTEMPTS}):`,
        error?.message,
      );
    }
  }
}

export const emailWorker = new EmailWorker();
