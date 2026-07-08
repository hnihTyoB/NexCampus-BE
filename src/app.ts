import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middlewares/error.middleware";
import routes from "./routes";
import { swaggerSpec, swaggerOptions } from "./config/swagger.config";

const app = express();

app.set("trust proxy", true);

app.use(
  helmet({
    contentSecurityPolicy: false, // Tắt CSP để Swagger UI tải được stylesheet
  }),
);
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, swaggerOptions),
);

app.use("/api/v1", routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
