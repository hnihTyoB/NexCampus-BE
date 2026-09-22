import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SystemSettingService } from "../src/modules/system-settings/system-setting.service";
import { SystemSettingRepository } from "../src/modules/system-settings/system-setting.repository";

class MockSystemSettingRepository extends SystemSettingRepository {
  private store = new Map<string, { key: string; value: string; category: string; description?: string; updatedAt: Date }>();

  async getAll() {
    return Array.from(this.store.values()).map((item) => ({
      ...item,
      id: "mock-id",
      createdAt: new Date(),
      updatedAt: item.updatedAt,
      description: item.description ?? null,
    })) as any;
  }

  async getByKey(key: string) {
    const item = this.store.get(key);
    if (!item) return null;
    return {
      ...item,
      id: "mock-id",
      createdAt: new Date(),
      updatedAt: item.updatedAt,
      description: item.description ?? null,
    } as any;
  }

  async upsert(key: string, value: string, category = "GENERAL", description?: string) {
    const entry = {
      key,
      value,
      category,
      description,
      updatedAt: new Date(),
    };
    this.store.set(key, entry);
    return {
      ...entry,
      id: "mock-id",
      createdAt: new Date(),
      description: description ?? null,
    } as any;
  }

  async delete(key: string) {
    const existing = this.store.get(key);
    this.store.delete(key);
    return (existing ?? { key }) as any;
  }
}

describe("SystemSettingService - Hạn Chốt Nộp Báo Cáo Ngày (Áp Dụng Hôm Sau Nếu Đã Đến/Qua Hạn)", () => {
  it("1. Cập nhật TRƯỚC giờ chốt nộp: áp dụng ngay trong ngày hôm nay", async () => {
    const mockRepo = new MockSystemSettingRepository();
    // Giả lập hiện tại là 10:00 sáng ngày 22/09/2026 (UTC: 03:00)
    let fakeNow = new Date("2026-09-22T03:00:00.000Z"); // 10:00 UTC+7
    const service = new SystemSettingService(mockRepo, () => ({ now: fakeNow }));

    // Khởi tạo mốc mặc định 17:30
    await mockRepo.upsert("DAILY_REPORT_DEADLINE_TIME", "17:30");

    // Đổi sang 18:00 lúc 10:00 sáng
    const updateResult = await service.updateSetting("DAILY_REPORT_DEADLINE_TIME", "18:00");

    assert.equal(updateResult.key, "DAILY_REPORT_DEADLINE_TIME");
    assert.equal(updateResult.value, "18:00");
    assert.equal(updateResult.appliesNextDay, false);

    const settings = await service.getSettings();
    assert.equal(settings.DAILY_REPORT_DEADLINE_TIME, "18:00");
    assert.equal(settings.NEXT_DAILY_REPORT_DEADLINE_TIME, undefined);
    assert.equal(settings.DAILY_REPORT_DEADLINE_APPLIES_NEXT_DAY, false);
  });

  it("2. Cập nhật KHI ĐÃ QUA GIỜ CHỐT (18:00 > 17:30): giữ mốc hôm nay, xếp lịch áp dụng vào ngày mai", async () => {
    const mockRepo = new MockSystemSettingRepository();
    // Giả lập hiện tại là 18:00 tối ngày 22/09/2026 (UTC: 11:00) -> Đã qua mốc 17:30
    let fakeNow = new Date("2026-09-22T11:00:00.000Z"); // 18:00 UTC+7
    const service = new SystemSettingService(mockRepo, () => ({ now: fakeNow }));

    await mockRepo.upsert("DAILY_REPORT_DEADLINE_TIME", "17:30");

    // Đổi sang 19:00 khi đã 18:00
    const updateResult = await service.updateSetting("DAILY_REPORT_DEADLINE_TIME", "19:00");

    assert.equal(updateResult.key, "DAILY_REPORT_DEADLINE_TIME");
    assert.equal(updateResult.value, "17:30"); // Hôm nay vẫn là 17:30
    assert.equal((updateResult as any).nextValue, "19:00");
    assert.equal(updateResult.appliesNextDay, true);
    assert.equal((updateResult as any).effectiveDate, "2026-09-23");

    // Khi gọi getSettings()
    const settings = await service.getSettings();
    assert.equal(settings.DAILY_REPORT_DEADLINE_TIME, "17:30");
    assert.equal(settings.NEXT_DAILY_REPORT_DEADLINE_TIME, "19:00");
    assert.equal(settings.DAILY_REPORT_DEADLINE_EFFECTIVE_DATE, "2026-09-23");
    assert.equal(settings.DAILY_REPORT_DEADLINE_APPLIES_NEXT_DAY, true);
  });

  it("3. Cập nhật mốc giờ mới ĐÃ NẰM TRONG QUÁ KHỨ của hôm nay: áp dụng vào ngày mai", async () => {
    const mockRepo = new MockSystemSettingRepository();
    // Giả lập hiện tại là 14:00 chiều ngày 22/09/2026 (UTC: 07:00)
    let fakeNow = new Date("2026-09-22T07:00:00.000Z"); // 14:00 UTC+7
    const service = new SystemSettingService(mockRepo, () => ({ now: fakeNow }));

    await mockRepo.upsert("DAILY_REPORT_DEADLINE_TIME", "17:30");

    // Đổi sang 12:00 trưa (mốc 12:00 đã qua trong ngày hôm nay)
    const updateResult = await service.updateSetting("DAILY_REPORT_DEADLINE_TIME", "12:00");

    assert.equal(updateResult.value, "17:30"); // Không làm hỏng hạn nộp hôm nay
    assert.equal((updateResult as any).nextValue, "12:00");
    assert.equal(updateResult.appliesNextDay, true);
    assert.equal((updateResult as any).effectiveDate, "2026-09-23");
  });

  it("4. Tự động chuyển đổi sang mốc giờ mới khi sang ngày hôm sau", async () => {
    const mockRepo = new MockSystemSettingRepository();
    // Ngày 1: Lúc 18:00 ngày 22/09/2026
    let fakeNow = new Date("2026-09-22T11:00:00.000Z"); // 18:00 UTC+7
    const service = new SystemSettingService(mockRepo, () => ({ now: fakeNow }));

    await mockRepo.upsert("DAILY_REPORT_DEADLINE_TIME", "17:30");
    await service.updateSetting("DAILY_REPORT_DEADLINE_TIME", "19:00");

    // Kiểm tra ngày 1: vẫn là 17:30
    assert.equal(await service.getDailyReportDeadline(), "17:30");

    // Ngày 2: Chuyển đồng hồ sang 08:00 sáng ngày 23/09/2026 (UTC: 01:00 ngày 23)
    fakeNow = new Date("2026-09-23T01:00:00.000Z");
    service.clearCache();

    // Gọi getSettings() hoặc getDailyReportDeadline() ngày hôm sau -> Phải tự động kích hoạt 19:00
    const deadline = await service.getDailyReportDeadline();
    assert.equal(deadline, "19:00");

    const settingsDay2 = await service.getSettings();
    assert.equal(settingsDay2.DAILY_REPORT_DEADLINE_TIME, "19:00");
    assert.equal(settingsDay2.NEXT_DAILY_REPORT_DEADLINE_TIME, undefined);
    assert.equal(settingsDay2.DAILY_REPORT_DEADLINE_APPLIES_NEXT_DAY, false);
  });
});
