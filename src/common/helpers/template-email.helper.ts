import { prisma } from "../../database/prisma.client";
import { EmailService } from "../services/email.service";
import { TEMPLATE_DEFAULTS } from "../constants/notification-template.constant";

function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{{${key}}}`,
  );
}

export class TemplateEmailHelper {
  static async send(
    to: string,
    type: string,
    params: Record<string, unknown>,
  ): Promise<boolean> {
    const template = await prisma.notificationTemplate.findUnique({
      where: { type },
      select: {
        emailSubjectTemplate: true,
        emailContentTemplate: true,
        titleTemplate: true,
        contentTemplate: true,
      },
    });

    const fallback = TEMPLATE_DEFAULTS[type];

    const rawSubject =
      template?.emailSubjectTemplate ||
      template?.titleTemplate ||
      fallback?.titleTemplate ||
      "Thông báo mới";

    const rawContent =
      template?.emailContentTemplate ||
      template?.contentTemplate ||
      fallback?.contentTemplate ||
      "";

    const subject = interpolate(rawSubject, params);
    const content = interpolate(rawContent, params);

    return EmailService.sendMail(to, subject, content);
  }
}
