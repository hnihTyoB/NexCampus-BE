import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middlewares/error.middleware";
import routes from "./routes";
import { swaggerSpec, swaggerOptions } from "./config/swagger.config";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import { appConfig } from "./config/app.config";

const app = express();

app.set("trust proxy", appConfig.trustProxy ?? false);

app.use(
  helmet({
    contentSecurityPolicy: false, // Tắt CSP để Swagger UI tải được stylesheet
  }),
);
const allowedOrigins = [
  appConfig.baseUrl,
  appConfig.baseUrl.replace("https://", "https://www."),
  "https://nexcampus.io.vn",
  "https://www.nexcampus.io.vn"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerOptions),
);

app.use("/api/v1", rateLimitMiddleware, routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
