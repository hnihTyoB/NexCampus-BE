import {
  SystemSettingRepository,
  systemSettingRepository,
} from "./system-setting.repository";
import { SystemSettingsResponseDto } from "./system-setting.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

interface CacheEntry {
  value: any;
  expiresAt: number;
}

const DEFAULT_SETTINGS: SystemSettingsResponseDto = {
  DAILY_REPORT_DEADLINE_TIME: "17:30",
  MAX_ACTIVE_TASKS: 5,
  MAX_WORKLOAD_DAYS: 14,
  MAX_LEADER_DEPARTMENTS: 3,
  SUBMISSION_MAX_FILE_SIZE_MB: 50,
  REPORT_MAX_FILE_SIZE_MB: 10,
  REPORT_VIDEO_MAX_FILE_SIZE_MB: 50,
  TASK_ATTACHMENT_MAX_FILE_SIZE_MB: 25,
  APPLICATION_MAX_FILE_SIZE_MB: 10,
  ALLOW_CROSS_DEPARTMENT_ASSIGNMENT: true,
  AUTO_EVALUATION_ENABLED: false,
};

export class SystemSettingService {
  private readonly repository: SystemSettingRepository = systemSettingRepository;
  private cache = new Map<string, CacheEntry>();
  private allSettingsCache: { data: SystemSettingsResponseDto; expiresAt: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

  /**
   * Helper parse string value sang type tương ứng (number, boolean, string)
   */
  private parseValue(key: string, rawValue: string): string | number | boolean {
    if (rawValue === "true") return true;
    if (rawValue === "false") return false;

    const defaultVal = (DEFAULT_SETTINGS as any)[key];
    if (typeof defaultVal === "number" || /_MB$|^MAX_/.test(key)) {
      const num = Number(rawValue);
      if (!isNaN(num)) return num;
    }

    return rawValue;
  }

  /**
   * Lấy toàn bộ cài đặt hệ thống (kết hợp cache và defaults)
   */
  async getSettings(): Promise<SystemSettingsResponseDto> {
    const now = Date.now();
    if (this.allSettingsCache && this.allSettingsCache.expiresAt > now) {
      return this.allSettingsCache.data;
    }

    const items = await this.repository.getAll();
    const result: any = { ...DEFAULT_SETTINGS };

    for (const item of items) {
      result[item.key] = this.parseValue(item.key, item.value);
    }

    this.allSettingsCache = { data: result, expiresAt: now + this.CACHE_TTL_MS };
    return result;
  }

  /**
   * Lấy giá trị của một cài đặt cụ thể
   */
  async getSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value as T;
    }

    const item = await this.repository.getByKey(key);
    if (!item) {
      if (defaultValue !== undefined) return defaultValue;
      if (key in DEFAULT_SETTINGS) {
        return (DEFAULT_SETTINGS as any)[key] as T;
      }
      throw new AppError(`Setting '${key}' not found`, 404, ERROR_CODE.NOT_FOUND);
    }

    const parsed = this.parseValue(key, item.value) as T;
    this.cache.set(key, { value: parsed, expiresAt: now + this.CACHE_TTL_MS });
    return parsed;
  }

  /**
   * Cập nhật một cài đặt và tự động xóa bộ đệm cache
   */
  async updateSetting(
    key: string,
    value: string | number | boolean,
    description?: string,
    category?: string
  ) {
    // Validation cụ thể theo nghiệp vụ
    if (key === "SUBMISSION_MAX_FILE_SIZE_MB") {
      const mb = Number(value);
      if (isNaN(mb) || mb < 5 || mb > 100) {
        throw new AppError(
          "Dung lượng bài nộp tối đa phải nằm trong khoảng từ 5 đến 100 MB",
          400,
          ERROR_CODE.VALIDATION_ERROR
        );
      }
    }

    if (key === "MAX_ACTIVE_TASKS") {
      const tasks = Number(value);
      if (isNaN(tasks) || tasks < 1 || tasks > 50) {
        throw new AppError(
          "Số task active tối đa của 1 TTS phải từ 1 đến 50",
          400,
          ERROR_CODE.VALIDATION_ERROR
        );
      }
    }

    if (key === "DAILY_REPORT_DEADLINE_TIME") {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (typeof value !== "string" || !timeRegex.test(value)) {
        throw new AppError(
          "Giờ chốt nộp báo cáo phải có định dạng HH:mm (VD: 17:30)",
          400,
          ERROR_CODE.VALIDATION_ERROR
        );
      }
    }

    const stringValue = String(value);
    const updated = await this.repository.upsert(
      key,
      stringValue,
      category || "GENERAL",
      description
    );

    // Xóa bộ đệm cache ngay lập tức
    this.clearCache();

    return {
      key: updated.key,
      value: this.parseValue(updated.key, updated.value),
      description: updated.description,
      category: updated.category,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Cập nhật hàng loạt cài đặt
   */
  async batchUpdate(settings: Record<string, string | number | boolean>) {
    const results: Record<string, any> = {};

    for (const [key, value] of Object.entries(settings)) {
      results[key] = await this.updateSetting(key, value);
    }

    this.clearCache();
    return results;
  }

  /**
   * Xóa toàn bộ in-memory cache
   */
  clearCache(): void {
    this.cache.clear();
    this.allSettingsCache = null;
  }

  // ── Helper Getters phục vụ các module nghiệp vụ ──

  async getDailyReportDeadline(): Promise<string> {
    return this.getSetting<string>("DAILY_REPORT_DEADLINE_TIME", "17:30");
  }

  async getMaxActiveTasks(): Promise<number> {
    return this.getSetting<number>("MAX_ACTIVE_TASKS", 5);
  }

  async getMaxWorkloadDays(): Promise<number> {
    return this.getSetting<number>("MAX_WORKLOAD_DAYS", 14);
  }

  async getSubmissionMaxFileSizeMb(): Promise<number> {
    return this.getSetting<number>("SUBMISSION_MAX_FILE_SIZE_MB", 50);
  }
}

export const systemSettingService = new SystemSettingService();
