import { NotificationSettingRepository } from './notification-setting.repository';

export class NotificationSettingService {
  private readonly repository = new NotificationSettingRepository();

  async getMe(userId: string) {
    let settings = await this.repository.findByUserId(userId);

    if (!settings) {
      settings = await this.repository.createDefault(userId);
    }

    return settings;
  }

  async updateMe(userId: string, data: any) {
    await this.getMe(userId);

    return this.repository.update(userId, data);
  }
}
