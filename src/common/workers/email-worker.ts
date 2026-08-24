import { envConfig } from '../../config/env.config';
import { MailService } from '../services/mail.service';
import { EmailTemplateService } from '../services/email-template.service';
import { EMAIL_STATUS, EMAIL_MAX_ATTEMPTS } from '../constants/notification.constant';
import { maintenanceCacheService } from '../services/maintenance-cache.service';
import { MAINTENANCE_STATUS } from '../constants/maintenance.constant';
import { notificationRepository, ClaimedEmailRecord } from '../../modules/notification/notification.repository';

const BATCH_SIZE = 20;

export class EmailWorker {
  private readonly mailService = new MailService();
  private readonly templateService = new EmailTemplateService();
  private intervalId?: ReturnType<typeof setInterval>;
  private isRunning = false;
  private activeBatchPromise?: Promise<void>;

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

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.activeBatchPromise) {
      await this.activeBatchPromise.catch(() => {});
    }
    console.log('[EmailWorker] Stopped cleanly');
  }

  private async process(): Promise<void> {
    if (this.isRunning) return; // Tránh chạy đồng thời nếu job trước chưa xong
    this.isRunning = true;

    this.activeBatchPromise = (async () => {
      try {
        const maintenanceConfig = await maintenanceCacheService.getConfig();
        if (maintenanceConfig.enabled && maintenanceConfig.status === MAINTENANCE_STATUS.MAINTENANCE) {
          // Tạm dừng xử lý hàng đợi email khi hệ thống đang ở chế độ bảo trì toàn diện
          return;
        }

        // Atomic claim via PostgreSQL FOR UPDATE SKIP LOCKED
        const pending = await notificationRepository.claimPendingEmails(BATCH_SIZE);

        if (!pending || pending.length === 0) {
          return;
        }

        console.log(`[EmailWorker] Processing ${pending.length} atomically claimed pending email(s)`);

        await Promise.allSettled(
          pending.map((record) => this.sendOne(record)),
        );
      } catch (error) {
        console.error('[EmailWorker] Unexpected error during processing:', error);
      } finally {
        this.isRunning = false;
        this.activeBatchPromise = undefined;
      }
    })();

    await this.activeBatchPromise;
  }

  private async sendOne(record: ClaimedEmailRecord): Promise<void> {
    try {
      const { html, subject } = await this.templateService.renderAsync(
        record.templateKey,
        record.templateData as Record<string, unknown>,
      );

      await this.mailService.sendRaw(record.toEmail, subject || record.subject, html);

      await notificationRepository.updateEmailStatus(record.id, {
        status: EMAIL_STATUS.SENT,
        sentAt: new Date(),
        attempts: record.attempts + 1,
        lastError: null,
      });

      console.log(`[EmailWorker] ✅ Sent email ${record.id} to ${record.toEmail}`);
    } catch (error: any) {
      const newAttempts = record.attempts + 1;
      const newStatus = newAttempts >= EMAIL_MAX_ATTEMPTS ? EMAIL_STATUS.FAILED : EMAIL_STATUS.PENDING;

      await notificationRepository.updateEmailStatus(record.id, {
        status: newStatus,
        attempts: newAttempts,
        lastError: error?.message ?? String(error),
      }).catch(() => {/* ignore update failure */});

      console.error(
        `[EmailWorker] ❌ Failed email ${record.id} (attempt ${newAttempts}/${EMAIL_MAX_ATTEMPTS}):`,
        error?.message,
      );
    }
  }
}

export const emailWorker = new EmailWorker();

