import { EmailService } from "../services/email.service";
import { TEMPLATE_DEFAULTS } from "../constants/notification-template.constant";
import { TemplateCacheHelper } from "./template-cache.helper";

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
    const template = await TemplateCacheHelper.getTemplate(type);

    const fallback = TEMPLATE_DEFAULTS[type];

    const isEdited =
      template &&
      template.createdAt &&
      template.updatedAt &&
      template.createdAt.getTime() !== template.updatedAt.getTime();

    const rawSubject = isEdited
      ? template.emailSubjectTemplate || template.titleTemplate || fallback?.titleTemplate || "Thông báo mới"
      : fallback?.emailSubjectTemplate || fallback?.titleTemplate || "Thông báo mới";

    const rawContent = isEdited
      ? template.emailContentTemplate || template.contentTemplate || fallback?.contentTemplate || ""
      : fallback?.emailContentTemplate || fallback?.contentTemplate || "";

    const subject = interpolate(rawSubject, params);
    const content = interpolate(rawContent, params);

    console.log(`[TemplateEmailHelper] Sending email — to: ${to}, subject: ${subject}`);
    const result = await EmailService.sendMail(to, subject, content);
    console.log(`[TemplateEmailHelper] sendMail result: ${result}`);
    return result;
  }
}
