import 'dotenv/config';
import app from './app';
import { envConfig } from './config/env.config';
import { emailWorker } from './common/workers/email-worker';

const PORT = envConfig.port;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} in ${envConfig.nodeEnv} mode`);
  emailWorker.start();
});
