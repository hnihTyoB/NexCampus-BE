import 'dotenv/config';
import app from './app';
import { envConfig } from './config/env.config';

const PORT = envConfig.port;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} in ${envConfig.nodeEnv} mode`);
});
