import 'dotenv/config';
import app from './app';
import { envConfig } from './config/env.config';
import { startNotificationWorker } from './queues/notification.worker';

const PORT = envConfig.port;

// Start background workers
startNotificationWorker();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} in ${envConfig.nodeEnv} mode`);
});
