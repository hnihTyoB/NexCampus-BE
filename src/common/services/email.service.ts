import nodemailer from "nodemailer";
import { envConfig } from "../../config/env.config";

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: envConfig.email.host,
    port: envConfig.email.port,
    secure: envConfig.email.port === 465,
    auth: {
      user: envConfig.email.user,
      pass: envConfig.email.pass,
    },
  });

  static async sendMail(
    to: string,
    subject: string,
    content: string,
  ): Promise<boolean> {
    if (
      !envConfig.email.host ||
      !envConfig.email.user ||
      !envConfig.email.pass
    ) {
      console.warn(
        "[EmailService] SMTP not configured — skipping email to:",
        to,
      );
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: envConfig.email.from,
        to,
        subject,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#4f46e5">NexCampus</h2>
          <p>${content}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <small style="color:#9ca3af">Đây là email tự động, vui lòng không phản hồi.</small>
        </div>`,
      });
      return true;
    } catch (error) {
      console.error("[EmailService] Failed to send email to:", to, error);
      return false;
    }
  }
}
