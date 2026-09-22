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

describe("SystemSettingService - Số Ngày Làm Việc Trong Tuần (Chỉ Thay Đổi Vào Ngày Chủ Nhật)", () => {
  it("1. Validation số ngày làm việc: từ chối số ngoài khoảng 1..7 hoặc số thập phân", async () => {
    const mockRepo = new MockSystemSettingRepository();
    // Giả lập Chủ nhật: 2026-09-27 10:00:00 UTC+7 (2026-09-27T03:00:00Z)
    const sunday = new Date("2026-09-27T03:00:00.000Z");
    const service = new SystemSettingService(mockRepo, () => ({ now: sunday }));

    await assert.rejects(
      async () => {
        await service.updateSetting("WORKING_DAYS_PER_WEEK", 0);
      },
      { message: /Số ngày làm việc trong tuần phải là số nguyên từ 1 đến 7/ }
    );

    await assert.rejects(
      async () => {
        await service.updateSetting("WORKING_DAYS_PER_WEEK", 8);
      },
      { message: /Số ngày làm việc trong tuần phải là số nguyên từ 1 đến 7/ }
    );

    await assert.rejects(
      async () => {
        await service.updateSetting("WORKING_DAYS_PER_WEEK", 5.5);
      },
      { message: /Số ngày làm việc trong tuần phải là số nguyên từ 1 đến 7/ }
    );
  });

  it("2. Cố tình thay đổi số ngày làm việc vào ngày THỨ BA (không phải Chủ nhật) -> Bị từ chối lỗi 400", async () => {
    const mockRepo = new MockSystemSettingRepository();
    // Giả lập Thứ Ba: 2026-09-22 10:00:00 UTC+7 (2026-09-22T03:00:00Z)
    const tuesday = new Date("2026-09-22T03:00:00.000Z");
    const service = new SystemSettingService(mockRepo, () => ({ now: tuesday }));

    await mockRepo.upsert("WORKING_DAYS_PER_WEEK", "6");

    // Thử đổi từ 6 sang 5 vào Thứ Ba
    await assert.rejects(
      async () => {
        await service.updateSetting("WORKING_DAYS_PER_WEEK", 5);
      },
      { message: /Số ngày làm việc trong tuần chỉ được phép thay đổi vào ngày Chủ nhật/ }
    );

    // Giá trị trong DB vẫn phải là 6
    assert.equal(await service.getWorkingDaysPerWeek(), 6);
  });

  it("3. Gửi cùng giá trị cũ (không đổi) vào ngày THỨ BA qua Batch Update -> Cho phép lưu thành công", async () => {
    const mockRepo = new MockSystemSettingRepository();
    // Giả lập Thứ Ba: 2026-09-22 10:00:00 UTC+7
    const tuesday = new Date("2026-09-22T03:00:00.000Z");
    const service = new SystemSettingService(mockRepo, () => ({ now: tuesday }));

    await mockRepo.upsert("WORKING_DAYS_PER_WEEK", "6");

    // Lưu batch update khi WORKING_DAYS_PER_WEEK vẫn là 6, chỉ sửa MAX_ACTIVE_TASKS
    const batchResult = await service.batchUpdate({
      WORKING_DAYS_PER_WEEK: 6,
      MAX_ACTIVE_TASKS: 8,
    });

    assert.equal(batchResult.WORKING_DAYS_PER_WEEK.value, 6);
    assert.equal(batchResult.MAX_ACTIVE_TASKS.value, 8);
  });

  it("4. Thay đổi số ngày làm việc vào ngày CHỦ NHẬT -> Thành công", async () => {
    const mockRepo = new MockSystemSettingRepository();
    // Giả lập Chủ nhật: 2026-09-27 10:00:00 UTC+7 (2026-09-27T03:00:00Z)
    const sunday = new Date("2026-09-27T03:00:00.000Z");
    const service = new SystemSettingService(mockRepo, () => ({ now: sunday }));

    await mockRepo.upsert("WORKING_DAYS_PER_WEEK", "6");

    // Đổi từ 6 sang 5 vào Chủ nhật
    const updateResult = await service.updateSetting("WORKING_DAYS_PER_WEEK", 5);
    assert.equal(updateResult.value, 5);

    // Kiểm tra getter và getSettings()
    assert.equal(await service.getWorkingDaysPerWeek(), 5);

    const settings = await service.getSettings();
    assert.equal(settings.WORKING_DAYS_PER_WEEK, 5);
  });
});
