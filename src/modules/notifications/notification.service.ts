import { NotificationRepository } from './notification.repository';
import { prisma } from '../../database/prisma.client';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { NotificationQueryDto, CreateNotificationDto } from './notification.dto';
import { ROLES } from '../../common/constants/role.constant';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class NotificationService {
  private readonly repository = new NotificationRepository();

  async findAll(query: NotificationQueryDto, user: UserPayload) {
    const userIdFilter = user.role === ROLES.INTERN ? user.id : undefined;
    return this.repository.findAll(query, userIdFilter);
  }

  async findById(id: string, user: UserPayload) {
    const notification = await this.repository.findById(id);

    if (!notification) {
      throw new AppError('Notification not found', 404, ERROR_CODE.NOT_FOUND);
    }

    if (user.role === ROLES.INTERN && notification.userId !== user.id) {
      throw new AppError('You are not authorized to view this notification', 403, ERROR_CODE.FORBIDDEN);
    }

    return notification;
  }

  async create(data: CreateNotificationDto) {
    const recipient = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!recipient) {
      throw new AppError('Recipient user not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return this.repository.create(data);
  }

  async markAsRead(id: string, user: UserPayload) {
    // This will perform the authorization and existence check
    const notification = await this.findById(id, user);

    if (notification.isRead) {
      return notification;
    }

    return this.repository.markAsRead(id);
  }

  async delete(id: string, user: UserPayload) {
    // This will perform the authorization and existence check
    await this.findById(id, user);

    return this.repository.delete(id);
  }
}
