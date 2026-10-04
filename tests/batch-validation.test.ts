import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { batchUpdateLeaderSchema } from "../src/modules/leaders/leader.validation";
import { batchUpdateInternSchema } from "../src/modules/interns/intern.validation";
import { batchAssignApplicationsSchema } from "../src/modules/applications/application.validation";

describe("Batch Update & Assign Schemas Validation Test Suite", () => {
  const id1 = "11111111-1111-4111-8111-111111111111";
  const id2 = "22222222-2222-4222-8222-222222222222";
  const dept1 = "33333333-3333-4333-8333-333333333333";
  const pos1 = "44444444-4444-4444-8444-444444444444";

  describe("1. batchUpdateLeaderSchema", () => {
    it("should accept valid distinct batch update items", () => {
      const result = batchUpdateLeaderSchema.safeParse({
        items: [
          { id: id1, position: "Lead", departmentIds: [dept1] },
          { id: id2, position: "Senior", departmentIds: [] },
        ],
      });
      assert.strictEqual(result.success, true);
    });

    it("should reject duplicate leader IDs in items", () => {
      const result = batchUpdateLeaderSchema.safeParse({
        items: [
          { id: id1, position: "Lead" },
          { id: id1, position: "Lead 2" },
        ],
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.errors.some((e) =>
            e.message.includes("Duplicate leader IDs"),
          ),
        );
      }
    });

    it("should reject leader with more than 3 departments", () => {
      const result = batchUpdateLeaderSchema.safeParse({
        items: [
          {
            id: id1,
            departmentIds: [
              "11111111-1111-4111-8111-111111111111",
              "22222222-2222-4222-8222-222222222222",
              "33333333-3333-4333-8333-333333333333",
              "44444444-4444-4444-8444-444444444444",
            ],
          },
        ],
      });
      assert.strictEqual(result.success, false);
    });
  });

  describe("2. batchUpdateInternSchema", () => {
    it("should accept valid distinct intern batch items", () => {
      const result = batchUpdateInternSchema.safeParse({
        items: [
          { id: id1, departmentId: dept1, positionId: pos1, status: "ACTIVE" },
          { id: id2, status: "COMPLETED" },
        ],
      });
      assert.strictEqual(result.success, true);
    });

    it("should reject duplicate intern IDs in items", () => {
      const result = batchUpdateInternSchema.safeParse({
        items: [
          { id: id1, status: "ACTIVE" },
          { id: id1, status: "DROPPED" },
        ],
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.errors.some((e) =>
            e.message.includes("Duplicate intern IDs"),
          ),
        );
      }
    });
  });

  describe("3. batchAssignApplicationsSchema", () => {
    it("should accept valid distinct application batch items", () => {
      const result = batchAssignApplicationsSchema.safeParse({
        items: [
          { id: id1, departmentId: dept1, positionId: pos1 },
          { id: id2, departmentId: null, positionId: null },
        ],
      });
      assert.strictEqual(result.success, true);
    });

    it("should reject duplicate application IDs in items", () => {
      const result = batchAssignApplicationsSchema.safeParse({
        items: [
          { id: id1, departmentId: dept1, positionId: null },
          { id: id1, departmentId: null, positionId: null },
        ],
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(
          result.error.errors.some((e) =>
            e.message.includes("Duplicate application IDs"),
          ),
        );
      }
    });

    it("should reject position assignment without department", () => {
      const result = batchAssignApplicationsSchema.safeParse({
        items: [{ id: id1, departmentId: null, positionId: pos1 }],
      });
      assert.strictEqual(result.success, false);
    });
  });
});
