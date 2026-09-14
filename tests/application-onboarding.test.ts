import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createInviteSchema,
  getApplicationInvitesSchema,
  verifyInviteParamSchema,
  createApplicationSchema,
  assignApplicationSchema,
  rejectApplicationSchema,
  reviewApplicationSchema,
  getBusinessToday,
  parseDateOnly,
} from "../src/modules/applications/application.validation";
import {
  APPLICATION_PREFERRED_DEPARTMENTS,
  APPLICATION_PREFERRED_POSITIONS,
  isValidApplicationPreference,
} from "../src/modules/applications/application-preference.constant";
import {
  APPLICATION_STATUS,
  APPLICATION_INVITE_STATUS,
} from "../src/common/constants/application.constant";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../src/common/constants/audit-log.constant";
import {
  EMAIL_TEMPLATE_KEY,
  DEFAULT_EMAIL_SUBJECTS,
} from "../src/common/constants/notification.constant";
import { VIETNAMESE_PHONE_REGEX } from "../src/common/helpers/phone.helper";

describe("Recruitment & Onboarding (Applications) Module Test Suite", () => {
  describe("1. Application Preferences & Static Rules", () => {
    it("should define all 7 required departments", () => {
      assert.deepEqual(APPLICATION_PREFERRED_DEPARTMENTS, [
        "Engineering",
        "Design",
        "Marketing",
        "Data",
        "QA",
        "HR",
        "Product",
      ]);
    });

    it("should validate valid department and position combinations", () => {
      assert.equal(
        isValidApplicationPreference("Engineering", "Backend Intern"),
        true,
      );
      assert.equal(
        isValidApplicationPreference("Engineering", "Frontend Intern"),
        true,
      );
      assert.equal(
        isValidApplicationPreference("Design", "UI/UX Intern"),
        true,
      );
      assert.equal(
        isValidApplicationPreference("Marketing", "Marketing Intern"),
        true,
      );
      assert.equal(isValidApplicationPreference("Data", "Data Intern"), true);
      assert.equal(isValidApplicationPreference("QA", "QA Intern"), true);
      assert.equal(isValidApplicationPreference("HR", "HR Intern"), true);
      assert.equal(
        isValidApplicationPreference("Product", "Product Intern"),
        true,
      );
    });

    it("should reject mismatched or nonexistent positions", () => {
      assert.equal(
        isValidApplicationPreference("Engineering", "HR Intern"),
        false,
      );
      assert.equal(
        isValidApplicationPreference("Marketing", "Backend Intern"),
        false,
      );
      assert.equal(
        isValidApplicationPreference("NonExistent", "Backend Intern"),
        false,
      );
    });
  });

  describe("2. Application Invite Validation", () => {
    it("should accept valid email in createInviteSchema", () => {
      const parsed = createInviteSchema.safeParse({
        email: "candidate@university.edu.vn",
      });
      assert.equal(parsed.success, true);
    });

    it("should reject invalid email in createInviteSchema", () => {
      const parsed = createInviteSchema.safeParse({
        email: "invalid-email",
      });
      assert.equal(parsed.success, false);
    });

    it("should coerce pagination numbers in getApplicationInvitesSchema", () => {
      const parsed = getApplicationInvitesSchema.safeParse({
        page: "2",
        limit: "15",
        status: APPLICATION_INVITE_STATUS.UNUSED,
        order: "desc",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.page, 2);
        assert.equal(parsed.data.limit, 15);
        assert.equal(parsed.data.status, "UNUSED");
      }
    });

    it("should accept valid token in verifyInviteParamSchema", () => {
      const parsed = verifyInviteParamSchema.safeParse({
        token: "abcdef1234567890abcdef1234567890",
      });
      assert.equal(parsed.success, true);
    });

    it("should reject empty token in verifyInviteParamSchema", () => {
      const parsed = verifyInviteParamSchema.safeParse({
        token: "   ",
      });
      assert.equal(parsed.success, false);
    });
  });

  describe("3. StartDate Calendar Constraints in Asia/Ho_Chi_Minh", () => {
    it("should parse valid YYYY-MM-DD string correctly", () => {
      const date = parseDateOnly("2026-10-15");
      assert.ok(date);
      assert.equal(date.getUTCFullYear(), 2026);
      assert.equal(date.getUTCMonth(), 9); // October is index 9
      assert.equal(date.getUTCDate(), 15);
    });

    it("should return null for invalid date formats", () => {
      assert.equal(parseDateOnly("15-10-2026"), null);
      assert.equal(parseDateOnly("invalid"), null);
      assert.equal(parseDateOnly("2026-02-31"), null); // Feb 31 does not exist
    });

    it("should reject past dates", () => {
      // Find a weekday in 2020
      const parsed = createApplicationSchema.safeParse({
        fullName: "Nguyen Van A",
        email: "candidate@gmail.com",
        phone: "0912345678",
        preferredDepartment: "Engineering",
        preferredPosition: "Backend Intern",
        startDate: "2020-01-06", // Monday in 2020 (past)
        token: "valid-token",
        acceptedRegulations: true,
      });
      assert.equal(parsed.success, false);
    });

    it("should reject Saturday and Sunday start dates", () => {
      // 2026-10-17 is Saturday, 2026-10-18 is Sunday
      const saturdayParsed = createApplicationSchema.safeParse({
        fullName: "Nguyen Van A",
        email: "candidate@gmail.com",
        phone: "0912345678",
        preferredDepartment: "Engineering",
        preferredPosition: "Backend Intern",
        startDate: "2026-10-17", // Saturday
        token: "valid-token",
        acceptedRegulations: true,
      });
      assert.equal(saturdayParsed.success, false);

      const sundayParsed = createApplicationSchema.safeParse({
        fullName: "Nguyen Van A",
        email: "candidate@gmail.com",
        phone: "0912345678",
        preferredDepartment: "Engineering",
        preferredPosition: "Backend Intern",
        startDate: "2026-10-18", // Sunday
        token: "valid-token",
        acceptedRegulations: true,
      });
      assert.equal(sundayParsed.success, false);
    });

    it("should accept future weekdays (Monday to Friday)", () => {
      // 2026-10-19 is a Monday
      const mondayParsed = createApplicationSchema.safeParse({
        fullName: "Nguyen Van A",
        email: "candidate@gmail.com",
        phone: "0912345678",
        preferredDepartment: "Engineering",
        preferredPosition: "Backend Intern",
        startDate: "2026-10-19", // Monday
        token: "valid-token",
        acceptedRegulations: true,
      });
      assert.equal(mondayParsed.success, true);
    });
  });

  describe("4. Candidate Submission & Regulations Acceptance", () => {
    it("should reject application if acceptedRegulations is false", () => {
      const parsed = createApplicationSchema.safeParse({
        fullName: "Nguyen Van A",
        email: "candidate@gmail.com",
        phone: "0912345678",
        preferredDepartment: "Engineering",
        preferredPosition: "Backend Intern",
        startDate: "2026-10-19",
        token: "valid-token",
        acceptedRegulations: false,
      });
      assert.equal(parsed.success, false);
    });

    it("should reject mismatched department and position in submission", () => {
      const parsed = createApplicationSchema.safeParse({
        fullName: "Nguyen Van A",
        email: "candidate@gmail.com",
        phone: "0912345678",
        preferredDepartment: "Marketing",
        preferredPosition: "Backend Intern", // Mismatched
        startDate: "2026-10-19",
        token: "valid-token",
        acceptedRegulations: true,
      });
      assert.equal(parsed.success, false);
    });

    it("should accept valid submission with academic and optional CV fields", () => {
      const parsed = createApplicationSchema.safeParse({
        fullName: "Tran Thi B",
        email: "tranthib@hust.edu.vn",
        phone: "0987654321",
        university: "Đại học Bách Khoa Hà Nội",
        major: "Khoa học Máy tính",
        preferredDepartment: "Data",
        preferredPosition: "Data Intern",
        startDate: "2026-10-20", // Tuesday
        duration: 3,
        token: "mock-invite-token-12345",
        acceptedRegulations: true,
        cvUrl: "https://r2.nexcampus.edu.vn/applications/cv.pdf",
      });
      assert.equal(parsed.success, true);
    });
  });

  describe("5. Admin Workflow: Assign, Approve, Reject", () => {
    const deptId = "11111111-1111-1111-1111-111111111111";
    const posId = "22222222-2222-2222-2222-222222222222";

    it("should validate valid assignApplicationSchema", () => {
      const parsed = assignApplicationSchema.safeParse({
        departmentId: deptId,
        positionId: posId,
      });
      assert.equal(parsed.success, true);
    });

    it("should reject positionId without departmentId in assignApplicationSchema", () => {
      const parsed = assignApplicationSchema.safeParse({
        departmentId: null,
        positionId: posId,
      });
      assert.equal(parsed.success, false);
    });

    it("should validate rejectApplicationSchema with non-empty reason", () => {
      const valid = rejectApplicationSchema.safeParse({
        rejectedReason: "Hồ sơ không đáp ứng yêu cầu kỹ năng đầu vào",
      });
      assert.equal(valid.success, true);

      const invalid = rejectApplicationSchema.safeParse({
        rejectedReason: "   ",
      });
      assert.equal(invalid.success, false);
    });

    it("should validate reviewApplicationSchema for both APPROVED and REJECTED", () => {
      const approveParsed = reviewApplicationSchema.safeParse({
        status: APPLICATION_STATUS.APPROVED,
      });
      assert.equal(approveParsed.success, true);

      const rejectParsed = reviewApplicationSchema.safeParse({
        status: APPLICATION_STATUS.REJECTED,
        rejectedReason: "Không phù hợp thời gian thực tập",
      });
      assert.equal(rejectParsed.success, true);
    });
  });

  describe("6. Permissions, Audit Actions & Notification Constants", () => {
    it("should define all Application & Invite permissions", () => {
      assert.ok(PERMISSIONS.APPLICATION_READ);
      assert.ok(PERMISSIONS.APPLICATION_CREATE);
      assert.ok(PERMISSIONS.APPLICATION_ASSIGN);
      assert.ok(PERMISSIONS.APPLICATION_REVIEW);
      assert.ok(PERMISSIONS.APPLICATION_DELETE);
      assert.ok(PERMISSIONS.APPLICATION_INVITE_READ);
      assert.ok(PERMISSIONS.APPLICATION_INVITE_CREATE);
      assert.ok(PERMISSIONS.APPLICATION_INVITE_REVOKE);
    });

    it("should define all Application audit actions and target types", () => {
      assert.equal(
        AUDIT_ACTION.CREATE_APPLICATION_INVITE,
        "CREATE_APPLICATION_INVITE",
      );
      assert.equal(
        AUDIT_ACTION.REVOKE_APPLICATION_INVITE,
        "REVOKE_APPLICATION_INVITE",
      );
      assert.equal(AUDIT_ACTION.CREATE_APPLICATION, "CREATE_APPLICATION");
      assert.equal(AUDIT_ACTION.ASSIGN_APPLICATION, "ASSIGN_APPLICATION");
      assert.equal(AUDIT_ACTION.APPROVE_APPLICATION, "APPROVE_APPLICATION");
      assert.equal(AUDIT_ACTION.REJECT_APPLICATION, "REJECT_APPLICATION");
      assert.equal(AUDIT_ACTION.DELETE_APPLICATION, "DELETE_APPLICATION");

      assert.equal(AUDIT_TARGET_TYPE.APPLICATION, "APPLICATION");
      assert.equal(AUDIT_TARGET_TYPE.APPLICATION_INVITE, "APPLICATION_INVITE");
    });

    it("should define email templates and default subjects for onboarding", () => {
      assert.equal(
        EMAIL_TEMPLATE_KEY.APPLICATION_INVITE,
        "APPLICATION_INVITE",
      );
      assert.equal(
        EMAIL_TEMPLATE_KEY.APPLICATION_APPROVED,
        "APPLICATION_APPROVED",
      );
      assert.equal(
        EMAIL_TEMPLATE_KEY.APPLICATION_REJECTED,
        "APPLICATION_REJECTED",
      );

      assert.ok(DEFAULT_EMAIL_SUBJECTS[EMAIL_TEMPLATE_KEY.APPLICATION_INVITE]);
      assert.ok(
        DEFAULT_EMAIL_SUBJECTS[EMAIL_TEMPLATE_KEY.APPLICATION_APPROVED],
      );
      assert.ok(
        DEFAULT_EMAIL_SUBJECTS[EMAIL_TEMPLATE_KEY.APPLICATION_REJECTED],
      );
    });
  });
});
