import "dotenv/config";
import app from "./app";
import { envConfig } from "./config/env.config";
import { startNotificationWorker } from "./queues/notification.worker";
import { startStorageCleanupWorker } from "./queues/storage-cleanup.worker";
import { scheduleStorageCleanupJob } from "./queues/storage-cleanup.queue";

const PORT = envConfig.port;

// Start background workers
startNotificationWorker();
startStorageCleanupWorker();

// Schedule repeatable jobs
scheduleStorageCleanupJob().catch((err) => {
  console.error("[Server] Failed to schedule storage cleanup job:", err);
});

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT} in ${envConfig.nodeEnv} mode`,
  );
});
