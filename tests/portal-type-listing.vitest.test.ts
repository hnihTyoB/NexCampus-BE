import { describe, it, expect } from "vitest";
import { userRepository } from "../src/modules/users/user.repository";
import { LeaderRepository } from "../src/modules/leaders/leader.repository";
import { InternRepository } from "../src/modules/interns/intern.repository";

describe("Portal-Type Table Display Isolation", () => {
  it("should query admin-team users strictly by portalType ADMIN", async () => {
    const res = await userRepository.findAll({ portalType: "ADMIN" });
    expect(res.data.length).toBeGreaterThan(0);
    for (const u of res.data) {
      expect(u.role?.portalType).toBe("ADMIN");
      expect(u.role?.name).not.toBe("USER");
      expect(u.role?.name).not.toBe("LEADER");
      expect(u.role?.name).not.toBe("INTERN");
    }
  });

  it("should query leaders strictly by portalType LEADER", async () => {
    const repo = new LeaderRepository();
    const res = await repo.findAll({});
    expect(res.data.length).toBeGreaterThan(0);
    for (const l of res.data) {
      expect(l.user.role?.portalType).toBe("LEADER");
    }
  });

  it("should query interns strictly by portalType INTERN", async () => {
    const repo = new InternRepository();
    const res = await repo.findAll({});
    expect(res.data.length).toBeGreaterThan(0);
    for (const i of res.data) {
      expect(i.user.role?.portalType).toBe("INTERN");
    }
  });
});
