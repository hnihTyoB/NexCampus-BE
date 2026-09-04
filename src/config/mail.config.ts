import { envConfig } from "./env.config";

export const mailConfig = {
  host: envConfig.mail.host,
  port: envConfig.mail.port,
  secure: envConfig.mail.secure,
  auth: {
    user: envConfig.mail.user,
    pass: envConfig.mail.pass,
  },
  from: envConfig.mail.from,
  verificationUrl: `${envConfig.appUrl}/api/v1/auth/verify-email`,
  resetPasswordUrl: `${envConfig.appUrl}/api/v1/auth/reset-password`,
};
