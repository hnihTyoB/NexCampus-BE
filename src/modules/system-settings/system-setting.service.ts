import { SystemSettingRepository } from "./system-setting.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

let cachedSubmissionLimitMb: number | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 phút cache

export class SystemSettingService {
  private readonly repository = new SystemSettingRepository();

  async getSettings() {
    const list = await this.repository.getAll();
    const settings: Record<string, string | number> = {
      AVATAR_MAX_FILE_SIZE_MB: 2, // Khóa cứng 2MB
      REPORT_MAX_FILE_SIZE_MB: 5, // Khóa cứng 5MB
      SUBMISSION_MAX_FILE_SIZE_MB: 50, // Mặc định 50MB
    };

    for (const item of list) {
      if (item.key === "SUBMISSION_MAX_FILE_SIZE_MB") {
        settings[item.key] = parseInt(item.value, 10) || 50;
      } else {
        settings[item.key] = item.value;
      }
    }

    return settings;
  }

  async updateSetting(key: string, value: string) {
    if (key === "SUBMISSION_MAX_FILE_SIZE_MB") {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 5 || numValue > 50) {
        throw new AppError(
          "Submission max file size must be a number between 5 and 50 MB",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      // Xóa cache khi cập nhật thành công
      cachedSubmissionLimitMb = null;
    } else {
      throw new AppError(
        `Setting key "${key}" is not modifiable.`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    return this.repository.update(key, value);
  }

  async getSubmissionLimitMb(): Promise<number> {
    const now = Date.now();
    if (cachedSubmissionLimitMb !== null && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedSubmissionLimitMb;
    }

    try {
      const setting = await this.repository.get("SUBMISSION_MAX_FILE_SIZE_MB");
      const mb = setting ? parseInt(setting.value, 10) : 50;
      cachedSubmissionLimitMb = Math.min(Math.max(mb, 5), 100); // Giới hạn trần 100MB bảo vệ RAM
      cacheTimestamp = now;
      return cachedSubmissionLimitMb;
    } catch (err) {
      return 50; // Fallback
    }
  }
}
export const systemSettingService = new SystemSettingService();
