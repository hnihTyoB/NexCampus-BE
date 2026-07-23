import nodemailer from "nodemailer";
import { mailConfig } from "../../config/mail.config";

export class EmailService {
  private static transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.pass,
    },
  });

  static async sendMail(
    to: string,
    subject: string,
    content: string,
  ): Promise<boolean> {
    if (
      !mailConfig.host ||
      !mailConfig.user ||
      !mailConfig.pass
    ) {
      console.warn(
        "[EmailService] SMTP not configured — skipping email to:",
        to,
      );
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: mailConfig.from,
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
