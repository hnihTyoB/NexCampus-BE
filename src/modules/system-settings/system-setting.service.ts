import {
  SystemSettingRepository,
  systemSettingRepository,
} from "./system-setting.repository";
import { SystemSettingsResponseDto } from "./system-setting.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { VIETNAM_TIMEZONE } from "../../common/constants/date.constant";

interface CacheEntry {
  value: any;
  expiresAt: number;
}

const DEFAULT_SETTINGS: SystemSettingsResponseDto = {
  DAILY_REPORT_DEADLINE_TIME: "17:30",
  WORKING_DAYS_PER_WEEK: 6,
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
  private cache = new Map<string, CacheEntry>();
  private allSettingsCache: { data: SystemSettingsResponseDto; expiresAt: number } | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

  constructor(
    private readonly repository: SystemSettingRepository = systemSettingRepository,
    private readonly getCurrentTimeFn: () => { now: Date } = () => ({ now: new Date() })
  ) {}

  /**
   * Helper lấy ngày và giờ hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
   */
  getVietnamNow(): { dateStr: string; timeStr: string; tomorrowStr: string; dayOfWeek: number; now: Date } {
    const { now } = this.getCurrentTimeFn();
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: VIETNAM_TIMEZONE,
    }).format(now); // "YYYY-MM-DD"
    const timeStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: VIETNAM_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now); // "HH:mm"

    // Tính ngày mai theo múi giờ Việt Nam
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: VIETNAM_TIMEZONE,
    }).format(tomorrow); // "YYYY-MM-DD"

    const vnDate = new Date(now.toLocaleString("en-US", { timeZone: VIETNAM_TIMEZONE }));
    const dayOfWeek = vnDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    return { dateStr, timeStr, tomorrowStr, dayOfWeek, now };
  }

  /**
   * Tự động kiểm tra và luân chuyển mốc giờ ngày mai thành mốc giờ chính thức nếu đã sang ngày mới
   */
  async promotePendingNextDayDeadlineIfNeeded(): Promise<boolean> {
    try {
      const nextDeadlineItem = await this.repository.getByKey("NEXT_DAILY_REPORT_DEADLINE_TIME");
      const effectiveDateItem = await this.repository.getByKey("DAILY_REPORT_DEADLINE_EFFECTIVE_DATE");

      if (nextDeadlineItem && effectiveDateItem) {
        const { dateStr } = this.getVietnamNow();
        // Nếu ngày hiện tại >= effectiveDate thì kích hoạt mốc mới
        if (dateStr >= effectiveDateItem.value) {
          await this.repository.upsert(
            "DAILY_REPORT_DEADLINE_TIME",
            nextDeadlineItem.value,
            "GENERAL",
            "Thời gian chốt nộp báo cáo ngày"
          );
          await this.repository.delete("NEXT_DAILY_REPORT_DEADLINE_TIME").catch(() => {});
          await this.repository.delete("DAILY_REPORT_DEADLINE_EFFECTIVE_DATE").catch(() => {});
          this.clearCache();
          return true;
        }
      }
    } catch {
      // Bỏ qua lỗi dọn dẹp nếu có
    }
    return false;
  }

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

    await this.promotePendingNextDayDeadlineIfNeeded();

    const items = await this.repository.getAll();
    const result: any = { ...DEFAULT_SETTINGS };

    for (const item of items) {
      result[item.key] = this.parseValue(item.key, item.value);
    }

    if (result.NEXT_DAILY_REPORT_DEADLINE_TIME && result.DAILY_REPORT_DEADLINE_EFFECTIVE_DATE) {
      result.DAILY_REPORT_DEADLINE_APPLIES_NEXT_DAY = true;
    } else {
      result.DAILY_REPORT_DEADLINE_APPLIES_NEXT_DAY = false;
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

    if (key === "WORKING_DAYS_PER_WEEK") {
      const days = Number(value);
      if (isNaN(days) || !Number.isInteger(days) || days < 1 || days > 7) {
        throw new AppError(
          "Số ngày làm việc trong tuần phải là số nguyên từ 1 đến 7",
          400,
          ERROR_CODE.VALIDATION_ERROR
        );
      }

      const currentItem = await this.repository.getByKey("WORKING_DAYS_PER_WEEK");
      const currentDays = currentItem ? Number(currentItem.value) : (DEFAULT_SETTINGS.WORKING_DAYS_PER_WEEK ?? 6);

      if (days !== currentDays) {
        const { dayOfWeek } = this.getVietnamNow();
        if (dayOfWeek !== 0) {
          throw new AppError(
            "Số ngày làm việc trong tuần chỉ được phép thay đổi vào ngày Chủ nhật",
            400,
            ERROR_CODE.VALIDATION_ERROR
          );
        }
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

      const { timeStr, tomorrowStr } = this.getVietnamNow();
      // Lấy mốc giờ chốt hiện tại đang áp dụng của hôm nay
      const currentItem = await this.repository.getByKey("DAILY_REPORT_DEADLINE_TIME");
      const currentActiveDeadline = currentItem?.value || "17:30";

      // Nếu đã đến hạn hoặc qua hạn chốt cũ, HOẶC mốc mới đã nằm trong quá khứ của hôm nay
      const isPastCutoff = timeStr >= currentActiveDeadline || timeStr >= value;

      if (isPastCutoff) {
        // Đảm bảo DAILY_REPORT_DEADLINE_TIME của hôm nay vẫn giữ nguyên mốc cũ
        await this.repository.upsert(
          "DAILY_REPORT_DEADLINE_TIME",
          currentActiveDeadline,
          category || "GENERAL",
          description || "Thời gian chốt nộp báo cáo ngày"
        );

        // Lưu mốc mới vào NEXT_DAILY_REPORT_DEADLINE_TIME và ngày có hiệu lực
        const nextUpdated = await this.repository.upsert(
          "NEXT_DAILY_REPORT_DEADLINE_TIME",
          value,
          category || "GENERAL",
          "Giờ chốt nộp báo cáo ngày áp dụng từ ngày mai"
        );
        await this.repository.upsert(
          "DAILY_REPORT_DEADLINE_EFFECTIVE_DATE",
          tomorrowStr,
          category || "GENERAL",
          "Ngày bắt đầu áp dụng giờ chốt nộp báo cáo mới"
        );

        this.clearCache();

        return {
          key: "DAILY_REPORT_DEADLINE_TIME",
          value: currentActiveDeadline,
          nextValue: value,
          effectiveDate: tomorrowStr,
          appliesNextDay: true,
          description: nextUpdated.description,
          category: nextUpdated.category,
          updatedAt: nextUpdated.updatedAt,
        };
      } else {
        // Hôm nay chưa đến hạn và mốc giờ mới vẫn ở tương lai hôm nay -> Áp dụng ngay hôm nay!
        const updated = await this.repository.upsert(
          key,
          value,
          category || "GENERAL",
          description
        );

        // Dọn dẹp mốc pending nếu có trước đó
        await this.repository.delete("NEXT_DAILY_REPORT_DEADLINE_TIME").catch(() => {});
        await this.repository.delete("DAILY_REPORT_DEADLINE_EFFECTIVE_DATE").catch(() => {});

        this.clearCache();

        return {
          key: updated.key,
          value: updated.value,
          appliesNextDay: false,
          description: updated.description,
          category: updated.category,
          updatedAt: updated.updatedAt,
        };
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
    await this.promotePendingNextDayDeadlineIfNeeded();
    return this.getSetting<string>("DAILY_REPORT_DEADLINE_TIME", "17:30");
  }

  async getWorkingDaysPerWeek(): Promise<number> {
    return this.getSetting<number>("WORKING_DAYS_PER_WEEK", 6);
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
