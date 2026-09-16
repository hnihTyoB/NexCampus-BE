import { NotificationSettingRepository } from "./notification-setting.repository";
import {
  NotificationSettingDto,
  UpdateNotificationSettingDto,
} from "./notification-setting.dto";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";

export class NotificationSettingService {
  private readonly repository = new NotificationSettingRepository();

  async getSettings(userId: string): Promise<NotificationSettingDto> {
    return this.repository.findOrCreateDefault(userId);
  }

  async updateSettings(
    userId: string,
    data: UpdateNotificationSettingDto,
    context?: { ipAddress?: string },
  ): Promise<NotificationSettingDto> {
    const updated = await this.repository.update(userId, data);

    await this.repository.createAuditLog({
      actorId: userId,
      action: AUDIT_ACTION.UPDATE_NOTIFICATION_SETTING,
      targetType: AUDIT_TARGET_TYPE.NOTIFICATION_SETTING,
      targetId: updated.id,
      details: {
        userId,
        updatedFields: Object.keys(data),
      },
      ipAddress: context?.ipAddress,
    });

    return updated;
  }
}
