import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import routes from './routes';
import { swaggerSpec, swaggerOptions } from './config/swagger.config';
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { requestIdMiddleware } from './middlewares/request-id.middleware';
import { envConfig } from './config/env.config';

const app = express();

app.set('trust proxy', envConfig.trustProxy);

app.use(requestIdMiddleware);
app.use(helmet({ contentSecurityPolicy: false }));


const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = envConfig.cors.allowedOrigins;
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowed.includes('*')) {
      if (envConfig.nodeEnv !== 'production') {
        callback(null, true);
        return;
      }
    }
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(morgan(envConfig.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));

app.use('/api/v1', rateLimitMiddleware, routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;

