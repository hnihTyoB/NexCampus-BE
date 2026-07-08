import { NotificationLogRepository } from "./notification-log.repository";
import { prisma } from "../../database/prisma.client";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  NotificationLogQueryDto,
  CreateNotificationLogDto,
  UpdateNotificationLogDto,
} from "./notification-log.dto";
import { ROLES } from "../../common/constants/role.constant";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class NotificationLogService {
  private readonly repository = new NotificationLogRepository();

  async findAll(query: NotificationLogQueryDto, user: UserPayload) {
    const userIdFilter = user.role === ROLES.INTERN ? user.id : undefined;
    return this.repository.findAll(query, userIdFilter);
  }

  async findById(id: string) {
    const log = await this.repository.findById(id);

    if (!log) {
      throw new AppError(
        "Notification log not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    return log;
  }

  async create(data: CreateNotificationLogDto) {
    // Ensure parent Notification exists
    const notification = await prisma.notification.findUnique({
      where: { id: data.notificationId },
    });

    if (!notification) {
      throw new AppError("Notification not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return this.repository.create(data);
  }

  async update(id: string, data: UpdateNotificationLogDto) {
    await this.findById(id);

    return this.repository.update(id, data);
  }

  async delete(id: string) {
    await this.findById(id);

    return this.repository.delete(id);
  }
}
