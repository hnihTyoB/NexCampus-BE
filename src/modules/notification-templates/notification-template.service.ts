import { NotificationTemplateRepository } from "./notification-template.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { UpdateNotificationTemplateDto } from "./notification-template.dto";

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

  async update(id: string, data: UpdateNotificationTemplateDto) {
    await this.findById(id);

    return this.repository.update(id, data);
  }
}
