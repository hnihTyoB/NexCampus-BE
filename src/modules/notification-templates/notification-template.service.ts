import { NotificationTemplateRepository } from "./notification-template.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from "./notification-template.dto";

import { TEMPLATE_DEFAULTS } from "../../common/constants/notification-template.constant";
import { TemplateCacheHelper } from "../../common/helpers/template-cache.helper";

export class NotificationTemplateService {
  private readonly repository = new NotificationTemplateRepository();

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: string) {
    const template = await this.repository.findById(id);

    if (!template) {
      throw new AppError(
        "Notification template not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    return template;
  }

  async create(data: CreateNotificationTemplateDto) {
    const existing = await this.repository.findByType(data.type);
    if (existing) {
      throw new AppError(
        `Template with type "${data.type}" already exists`,
        409,
        ERROR_CODE.DUPLICATE_ENTRY,
      );
    }
    const res = await this.repository.create(data);
    TemplateCacheHelper.clearCache(data.type);
    return res;
  }

  async update(id: string, data: UpdateNotificationTemplateDto) {
    const template = await this.findById(id);
    const res = await this.repository.update(id, data);
    TemplateCacheHelper.clearCache(template.type);
    return res;
  }

  async upsertByType(
    type: string,
    data: {
      titleTemplate: string;
      contentTemplate: string;
      emailSubjectTemplate?: string | null;
      emailContentTemplate?: string | null;
    },
  ) {
    const res = await this.repository.upsertByType(type, data);
    TemplateCacheHelper.clearCache(type);
    return res;
  }

  async reset(id: string) {
    const template = await this.findById(id);

    const defaults = TEMPLATE_DEFAULTS[template.type];
    if (!defaults) {
      throw new AppError(
        `No default values found for template type "${template.type}"`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const res = await this.repository.resetToDefault(id, {
      titleTemplate: defaults.titleTemplate,
      contentTemplate: defaults.contentTemplate,
      emailSubjectTemplate: defaults.emailSubjectTemplate,
      emailContentTemplate: defaults.emailContentTemplate,
    });

    TemplateCacheHelper.clearCache(template.type);
    return res;
  }
}
