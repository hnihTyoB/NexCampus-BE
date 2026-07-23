import { envConfig } from "./env.config";

export const mailConfig = {
  host: envConfig.email.host,
  port: envConfig.email.port,
  secure: envConfig.email.port === 465,
  user: envConfig.email.user,
  pass: envConfig.email.pass,
  from: envConfig.email.from,
};

export default mailConfig;
