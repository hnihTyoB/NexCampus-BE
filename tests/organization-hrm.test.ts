import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createPositionSchema,
  findAllDepartmentSchema,
} from "../src/modules/departments/department.validation";
import {
  createLeaderSchema,
  updateLeaderSchema,
  findAllLeaderSchema,
} from "../src/modules/leaders/leader.validation";
import {
  createInternSchema,
  updateInternSchema,
  findAllInternSchema,
} from "../src/modules/interns/intern.validation";
import { VIETNAMESE_PHONE_REGEX } from "../src/common/helpers/phone.helper";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import { ROLES } from "../src/common/constants/role.constant";
import { INTERN_STATUS } from "../src/common/constants/intern.constant";
import {
  HRM_CONFIG_KEYS,
  STORAGE_CONFIG_KEYS,
  DEFAULT_SYSTEM_CONFIGS,
} from "../src/common/constants/system-config.constant";

describe("Organization & HRM Modules Test Suite", () => {
  describe("1. Department & Position Validation", () => {
    it("should accept valid department creation data", () => {
      const parsed = createDepartmentSchema.safeParse({
        name: "Engineering",
        positions: ["Frontend Developer", "Backend Developer"],
      });
      assert.equal(parsed.success, true);
    });

    it("should reject empty department name", () => {
      const parsed = createDepartmentSchema.safeParse({
        name: "   ",
      });
      assert.equal(parsed.success, false);
    });

    it("should validate position creation schema", () => {
      const parsed = createPositionSchema.safeParse({
        name: "Fullstack Engineer",
        departmentId: "11111111-1111-1111-1111-111111111111",
      });
      assert.equal(parsed.success, true);
    });

    it("should validate findAllDepartment query parameters", () => {
      const parsed = findAllDepartmentSchema.safeParse({
        name: "Design",
        leader: "Nguyen",
      });
      assert.equal(parsed.success, true);
    });
  });

  describe("2. Leader Validation & Business Rules", () => {
    const validUserId = "11111111-1111-1111-1111-111111111111";
    const dept1 = "22222222-2222-2222-2222-222222222222";
    const dept2 = "33333333-3333-3333-3333-333333333333";
    const dept3 = "44444444-4444-4444-4444-444444444444";
    const dept4 = "55555555-5555-5555-5555-555555555555";

    it("should accept leader with at most 3 departments", () => {
      const parsed = createLeaderSchema.safeParse({
        userId: validUserId,
        departmentIds: [dept1, dept2, dept3],
        position: "Tech Lead",
        phone: "0912345678",
      });
      assert.equal(parsed.success, true);
    });

    it("should reject leader with more than 3 departments", () => {
      const parsed = createLeaderSchema.safeParse({
        userId: validUserId,
        departmentIds: [dept1, dept2, dept3, dept4],
      });
      assert.equal(parsed.success, false);
    });

    it("should reject leader with duplicate department IDs", () => {
      const parsed = createLeaderSchema.safeParse({
        userId: validUserId,
        departmentIds: [dept1, dept2, dept1],
      });
      assert.equal(parsed.success, false);
    });

    it("should coerce pagination numbers in findAllLeaderSchema", () => {
      const parsed = findAllLeaderSchema.safeParse({
        page: "2",
        limit: "15",
        isActive: "true",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 2);
        assert.equal(parsed.data.limit, 15);
        assert.equal(parsed.data.isActive, true);
      }
    });
  });

  describe("3. Intern Validation & Academic Fields", () => {
    const validUserId = "11111111-1111-1111-1111-111111111111";
    const validDeptId = "22222222-2222-2222-2222-222222222222";
    const validPosId = "33333333-3333-3333-3333-333333333333";

    it("should accept valid intern creation data with academic fields", () => {
      const parsed = createInternSchema.safeParse({
        userId: validUserId,
        fullName: "Tran Van A",
        phone: "0987654321",
        departmentId: validDeptId,
        positionId: validPosId,
        startDate: "2026-10-01",
        duration: 3,
        internCode: "INT-20261001",
        university: "Đại học Bách Khoa",
        major: "Công nghệ Thông tin",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.university, "Đại học Bách Khoa");
        assert.equal(parsed.data.major, "Công nghệ Thông tin");
        assert.equal(parsed.data.duration, 3);
      }
    });

    it("should reject invalid phone format for intern", () => {
      const parsed = createInternSchema.safeParse({
        userId: validUserId,
        fullName: "Tran Van B",
        phone: "12345",
        departmentId: validDeptId,
        positionId: validPosId,
        startDate: "2026-10-01",
        duration: 3,
      });
      assert.equal(parsed.success, false);
    });

    it("should validate multi-field search in findAllInternSchema", () => {
      const parsed = findAllInternSchema.safeParse({
        search: "Bach Khoa",
        university: "HUST",
        major: "Software Engineering",
        status: INTERN_STATUS.ACTIVE,
        page: "1",
        limit: "25",
        sortBy: "internCode",
        order: "asc",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.search, "Bach Khoa");
        assert.equal(parsed.data.page, 1);
        assert.equal(parsed.data.limit, 25);
        assert.equal(parsed.data.sortBy, "internCode");
      }
    });
  });

  describe("4. Vietnamese Phone Regex Helper", () => {
    it("should match valid Vietnamese phone formats (03x, 05x, 07x, 08x, 09x, +84, 84)", () => {
      assert.equal(VIETNAMESE_PHONE_REGEX.test("0912345678"), true);
      assert.equal(VIETNAMESE_PHONE_REGEX.test("0389999999"), true);
      assert.equal(VIETNAMESE_PHONE_REGEX.test("+84912345678"), true);
      assert.equal(VIETNAMESE_PHONE_REGEX.test("84912345678"), true);
    });

    it("should reject invalid phone formats", () => {
      assert.equal(VIETNAMESE_PHONE_REGEX.test("0123456789"), false);
      assert.equal(VIETNAMESE_PHONE_REGEX.test("0912345"), false);
      assert.equal(VIETNAMESE_PHONE_REGEX.test("091234567890"), false);
      assert.equal(VIETNAMESE_PHONE_REGEX.test("abc1234567"), false);
    });
  });

  describe("5. RBAC Constants & Roles", () => {
    it("should define all required Department permissions", () => {
      assert.ok(PERMISSIONS.DEPARTMENT_READ);
      assert.ok(PERMISSIONS.DEPARTMENT_CREATE);
      assert.ok(PERMISSIONS.DEPARTMENT_UPDATE);
      assert.ok(PERMISSIONS.DEPARTMENT_DELETE);
      assert.ok(PERMISSIONS.POSITION_CREATE);
      assert.ok(PERMISSIONS.POSITION_UPDATE);
      assert.ok(PERMISSIONS.POSITION_DELETE);
    });

    it("should define all required Leader and Intern permissions", () => {
      assert.ok(PERMISSIONS.LEADER_READ);
      assert.ok(PERMISSIONS.LEADER_CREATE);
      assert.ok(PERMISSIONS.LEADER_UPDATE);
      assert.ok(PERMISSIONS.LEADER_DELETE);
      assert.ok(PERMISSIONS.INTERN_READ);
      assert.ok(PERMISSIONS.INTERN_CREATE);
      assert.ok(PERMISSIONS.INTERN_UPDATE);
      assert.ok(PERMISSIONS.INTERN_DELETE);
      assert.ok(PERMISSIONS.INTERN_ASSIGN_LEADER);
    });

    it("should define LEADER and INTERN roles", () => {
      assert.equal(ROLES.LEADER, "LEADER");
      assert.equal(ROLES.INTERN, "INTERN");
    });
  });

  describe("6. System Config & HRM Dynamic Configurations", () => {
    it("should define all required HRM and Storage config keys", () => {
      assert.equal(
        HRM_CONFIG_KEYS.MAX_LEADER_DEPARTMENTS,
        "hrm.max_leader_departments",
      );
      assert.equal(
        HRM_CONFIG_KEYS.DEFAULT_INTERN_DURATION_MONTHS,
        "hrm.default_intern_duration_months",
      );
      assert.equal(
        HRM_CONFIG_KEYS.INTERN_CODE_PREFIX,
        "hrm.intern_code_prefix",
      );
      assert.equal(
        HRM_CONFIG_KEYS.MAX_ACTIVE_TASKS_PER_INTERN,
        "hrm.max_active_tasks_per_intern",
      );
      assert.equal(
        HRM_CONFIG_KEYS.AUTO_COMPLETE_EXPIRED_INTERNS,
        "hrm.auto_complete_expired_interns",
      );

      assert.equal(
        STORAGE_CONFIG_KEYS.AVATAR_MAX_FILE_SIZE_MB,
        "storage.avatar_max_file_size_mb",
      );
      assert.equal(
        STORAGE_CONFIG_KEYS.SUBMISSION_MAX_FILE_SIZE_MB,
        "storage.submission_max_file_size_mb",
      );
    });

    it("should register default values for HRM configs in DEFAULT_SYSTEM_CONFIGS", () => {
      const configMap = new Map(
        DEFAULT_SYSTEM_CONFIGS.map((item) => [item.key, item.value]),
      );

      assert.equal(
        configMap.get(HRM_CONFIG_KEYS.MAX_LEADER_DEPARTMENTS),
        3,
      );
      assert.equal(
        configMap.get(HRM_CONFIG_KEYS.DEFAULT_INTERN_DURATION_MONTHS),
        3,
      );
      assert.equal(
        configMap.get(HRM_CONFIG_KEYS.INTERN_CODE_PREFIX),
        "INT",
      );
      assert.equal(
        configMap.get(HRM_CONFIG_KEYS.MAX_ACTIVE_TASKS_PER_INTERN),
        5,
      );
      assert.equal(
        configMap.get(HRM_CONFIG_KEYS.AUTO_COMPLETE_EXPIRED_INTERNS),
        true,
      );
      assert.equal(
        configMap.get(STORAGE_CONFIG_KEYS.SUBMISSION_MAX_FILE_SIZE_MB),
        50,
      );
    });

    it("should allow creating intern without explicit duration (defaulting dynamically)", () => {
      const parsed = createInternSchema.safeParse({
        userId: "11111111-1111-1111-1111-111111111111",
        fullName: "Le Thi C",
        phone: "0912345678",
        departmentId: "22222222-2222-2222-2222-222222222222",
        positionId: "33333333-3333-3333-3333-333333333333",
        startDate: "2026-10-01",
      });
      assert.equal(parsed.success, true);
    });
  });
});
