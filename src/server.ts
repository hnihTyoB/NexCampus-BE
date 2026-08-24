import 'dotenv/config';
import app from './app';
import { envConfig } from './config/env.config';
import { emailWorker } from './common/workers/email-worker';
import { webhookWorker } from './common/workers/webhook.worker';
import { cronWorker } from './common/workers/cron.worker';
import { webhookQueue } from './common/queues/webhook.queue';
import { cronQueue } from './common/queues/cron.queue';
import { maintenanceCacheService } from './common/services/maintenance-cache.service';
import { systemConfigService } from './modules/system-config/system-config.service';
import { sseManagerService } from './common/services/sse-manager.service';
import { prisma } from './database/prisma.client';

const PORT = envConfig.port;

const server = app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT} in ${envConfig.nodeEnv} mode`);
  
  // Ensure default system configs and feature flags are seeded
  await systemConfigService.ensureDefaultConfigs().catch((err) => {
    console.warn('[SystemConfig] Failed to seed default configs:', err.message);
  });

  // Start background workers and register cron schedules
  emailWorker.start();
  webhookWorker.start();
  cronWorker.start();
  await cronQueue.registerSchedules();
});

// Graceful Shutdown Handler
let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new HTTP requests
  server.close(async () => {
    console.log('[Server] HTTP server closed.');

    try {
      // 1. Stop background workers
      await emailWorker.stop();
      await webhookWorker.stop();
      await cronWorker.stop();
      console.log('[Server] Background workers stopped.');

      // 2. Close BullMQ queues, SSE streams & Redis connections
      await sseManagerService.close();
      await webhookQueue.close();
      await cronQueue.close();
      await maintenanceCacheService.close();
      await systemConfigService.close();
      console.log('[Server] SSE, Redis & Queue connections closed.');



      // 3. Disconnect Prisma DB client
      await prisma.$disconnect();
      console.log('[Server] Database client disconnected.');

      console.log('[Server] Graceful shutdown completed cleanly.');
      process.exit(0);
    } catch (err: any) {
      console.error('[Server] Error during graceful shutdown:', err.message);
      process.exit(1);
    }
  });

  // Force shutdown if taking longer than 10 seconds
  setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

