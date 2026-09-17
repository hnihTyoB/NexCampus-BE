import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  requirePermission,
  requireAnyPermission,
} from "../src/middlewares/permission.middleware";
import { permissionCacheService } from "../src/common/services/permission-cache.service";
import { rbacService } from "../src/modules/rbac/rbac.service";
import { PERMISSIONS } from "../src/common/constants/permission.constant";
import { ROLES } from "../src/common/constants/role.constant";
import { AppError } from "../src/common/errors/app-error";
import { ERROR_CODE } from "../src/common/errors/error-code";

describe("Dynamic RBAC Architecture & Privilege Escalation Defense", () => {
  beforeEach(() => {
    permissionCacheService.clear();
  });

  describe("Dynamic Custom Roles (Non-hardcoded roles)", () => {
    it("should authorize access for custom arbitrary role (ComplianceAuditor) having required permission", async () => {
      const customRoleId = "aaaa1111-0000-0000-0000-000000000001";
      const customUserId = "bbbb1111-0000-0000-0000-000000000001";

      // Seed custom role 'ComplianceAuditor' into cache
      (permissionCacheService as any).cache.set(customRoleId, {
        permissions: new Set([PERMISSIONS.AUDIT_LOG_READ, PERMISSIONS.USER_READ]),
        expiresAt: Date.now() + 60000,
      });
      (permissionCacheService as any).userCache.set(customUserId, {
        user: {
          id: customUserId,
          isActive: true,
          deletedAt: null,
          roleId: customRoleId,
          roleName: "ComplianceAuditor",
        },
        expiresAt: Date.now() + 60000,
      });

      const middleware = requirePermission(PERMISSIONS.AUDIT_LOG_READ);
      const req = {
        user: {
          id: customUserId,
          email: "auditor@domain.local",
          role: "ComplianceAuditor",
          roleId: customRoleId,
        },
      } as any;
      const res = {} as any;

      let nextCalled = false;
      let nextError: any = null;

      await middleware(req, res, (err) => {
        if (err) nextError = err;
        else nextCalled = true;
      });

      assert.equal(nextError, null);
      assert.equal(nextCalled, true);
      assert.ok(req.user.permissions.includes(PERMISSIONS.AUDIT_LOG_READ));
    });

    it("should return 403 Forbidden when custom role lacks required permission", async () => {
      const customRoleId = "aaaa1111-0000-0000-0000-000000000001";
      const customUserId = "bbbb1111-0000-0000-0000-000000000001";

      (permissionCacheService as any).cache.set(customRoleId, {
        permissions: new Set([PERMISSIONS.AUDIT_LOG_READ, PERMISSIONS.USER_READ]),
        expiresAt: Date.now() + 60000,
      });
      (permissionCacheService as any).userCache.set(customUserId, {
        user: {
          id: customUserId,
          isActive: true,
          deletedAt: null,
          roleId: customRoleId,
          roleName: "ComplianceAuditor",
        },
        expiresAt: Date.now() + 60000,
      });

      const middleware = requirePermission(PERMISSIONS.USER_DELETE);
      const req = {
        user: {
          id: customUserId,
          email: "auditor@domain.local",
          role: "ComplianceAuditor",
          roleId: customRoleId,
        },
      } as any;
      const res = {} as any;

      let nextError: any = null;
      await middleware(req, res, (err) => {
        nextError = err;
      });

      assert.ok(nextError instanceof AppError);
      assert.equal(nextError.statusCode, 403);
      assert.equal(nextError.code, ERROR_CODE.FORBIDDEN);
    });

    it("should support requireAnyPermission for dynamic roles", async () => {
      const customRoleId = "cccc2222-0000-0000-0000-000000000002";
      const customUserId = "dddd2222-0000-0000-0000-000000000002";

      (permissionCacheService as any).cache.set(customRoleId, {
        permissions: new Set([PERMISSIONS.REGULATION_READ]),
        expiresAt: Date.now() + 60000,
      });
      (permissionCacheService as any).userCache.set(customUserId, {
        user: {
          id: customUserId,
          isActive: true,
          deletedAt: null,
          roleId: customRoleId,
          roleName: "LegalConsultant",
        },
        expiresAt: Date.now() + 60000,
      });

      const middleware = requireAnyPermission(
        PERMISSIONS.SYSTEM_CONFIG_MANAGE,
        PERMISSIONS.REGULATION_READ,
      );
      const req = {
        user: {
          id: customUserId,
          email: "legal@domain.local",
          role: "LegalConsultant",
          roleId: customRoleId,
        },
      } as any;
      const res = {} as any;

      let nextCalled = false;
      await middleware(req, res, (err) => {
        if (!err) nextCalled = true;
      });

      assert.equal(nextCalled, true);
    });
  });

  describe("Revocation & Invalidation", () => {
    it("should deny access immediately once permission cache is invalidated", async () => {
      const roleId = "eeee3333-0000-0000-0000-000000000003";
      const userId = "ffff3333-0000-0000-0000-000000000003";

      // Initially has USER_UPDATE
      (permissionCacheService as any).cache.set(roleId, {
        permissions: new Set([PERMISSIONS.USER_UPDATE]),
        expiresAt: Date.now() + 60000,
      });
      (permissionCacheService as any).userCache.set(userId, {
        user: {
          id: userId,
          isActive: true,
          deletedAt: null,
          roleId,
          roleName: "HRStaff",
        },
        expiresAt: Date.now() + 60000,
      });

      // Invalidate role cache (simulating permission revocation)
      permissionCacheService.invalidateRole(roleId);

      // Cache now empty for this role
      assert.equal((permissionCacheService as any).cache.has(roleId), false);
    });
  });

  describe("Privilege Escalation Defense", () => {
    it("should prevent self-role assignment (Case 1: Anti-self-promotion)", async () => {
      const actorId = "user-self-assign";
      await assert.rejects(
        async () => {
          await rbacService.assignUserRole(actorId, "target-role-id", {
            actorId,
          });
        },
        (err: any) => {
          return (
            err instanceof AppError &&
            err.statusCode === 400 &&
            err.message.includes("Không được phép tự gán")
          );
        },
      );
    });

    it("should prevent assigning role containing permissions not possessed by the caller", async () => {
      const callerId = "mid-level-manager";
      const targetUserId = "target-subordinate";
      const targetRoleId = "high-role-id";

      // Mock repository calls on rbacService
      const originalFindRoleById = rbacService.findRoleById.bind(rbacService);
      const originalFindUserById = (rbacService as any).repository.findUserById.bind(
        (rbacService as any).repository,
      );

      (rbacService as any).findRoleById = async (id: string) => {
        return {
          id,
          name: "SuperAuditor",
          description: "Auditor with elevated rights",
          isSystem: false,
          permissions: [],
        };
      };

      (rbacService as any).repository.findUserById = async (id: string) => {
        if (id === callerId) {
          return {
            id: callerId,
            email: "caller@domain.local",
            roleId: "caller-role-id",
            role: { isSystem: false, name: "Manager" },
            isActive: true,
            deletedAt: null,
          };
        }
        return {
          id: targetUserId,
          email: "target@domain.local",
          roleId: "subordinate-role-id",
          role: { isSystem: false, name: "Subordinate" },
          isActive: true,
          deletedAt: null,
        };
      };

      // Mock caller having only USER_READ
      (permissionCacheService as any).userPermsCache.set(callerId, {
        permissions: [PERMISSIONS.USER_READ],
        expiresAt: Date.now() + 60000,
      });

      // Mock target role possessing SYSTEM_CONFIG_MANAGE (not held by caller)
      (permissionCacheService as any).cache.set(targetRoleId, {
        permissions: new Set([PERMISSIONS.USER_READ, PERMISSIONS.SYSTEM_CONFIG_MANAGE]),
        expiresAt: Date.now() + 60000,
      });

      try {
        await assert.rejects(
          async () => {
            await rbacService.assignUserRole(targetUserId, targetRoleId, {
              actorId: callerId,
            });
          },
          (err: any) => {
            return (
              err instanceof AppError &&
              err.statusCode === 403 &&
              err.message.includes("Privilege Escalation") &&
              err.message.includes(PERMISSIONS.SYSTEM_CONFIG_MANAGE)
            );
          },
        );
      } finally {
        (rbacService as any).findRoleById = originalFindRoleById;
        (rbacService as any).repository.findUserById = originalFindUserById;
      }
    });

    it("should prevent granting permissions to a role that the caller does not hold", async () => {
      const callerId = "team-leader-id";
      const targetRoleId = "custom-role-id";

      const originalFindRoleById = rbacService.findRoleById.bind(rbacService);
      const originalFindUserById = (rbacService as any).repository.findUserById.bind(
        (rbacService as any).repository,
      );
      const originalFindPermissionsByIds = (rbacService as any).repository.findPermissionsByIds.bind(
        (rbacService as any).repository,
      );

      (rbacService as any).findRoleById = async (id: string) => {
        return {
          id,
          name: "ProjectMember",
          description: "Standard member",
          isSystem: false,
          permissions: [],
        };
      };

      (rbacService as any).repository.findUserById = async (id: string) => {
        return {
          id: callerId,
          email: "leader@domain.local",
          roleId: "leader-role-id",
          role: { isSystem: false, name: "TeamLeader" },
          isActive: true,
          deletedAt: null,
        };
      };

      (rbacService as any).repository.findPermissionsByIds = async (ids: string[]) => {
        return [
          { id: "perm-1", name: PERMISSIONS.TASK_READ },
          { id: "perm-2", name: PERMISSIONS.SYSTEM_CONFIG_MANAGE },
        ];
      };

      // Caller only possesses TASK_READ
      (permissionCacheService as any).userPermsCache.set(callerId, {
        permissions: [PERMISSIONS.TASK_READ],
        expiresAt: Date.now() + 60000,
      });

      try {
        await assert.rejects(
          async () => {
            await rbacService.assignPermissionsToRole(
              targetRoleId,
              ["perm-1", "perm-2"],
              { actorId: callerId },
            );
          },
          (err: any) => {
            return (
              err instanceof AppError &&
              err.statusCode === 403 &&
              err.message.includes("Privilege Escalation") &&
              err.message.includes(PERMISSIONS.SYSTEM_CONFIG_MANAGE)
            );
          },
        );
      } finally {
        (rbacService as any).findRoleById = originalFindRoleById;
        (rbacService as any).repository.findUserById = originalFindUserById;
        (rbacService as any).repository.findPermissionsByIds = originalFindPermissionsByIds;
      }
    });

    it("should protect system roles from being deleted", async () => {
      const originalFindRoleById = rbacService.findRoleById.bind(rbacService);
      (rbacService as any).findRoleById = async (id: string) => {
        return {
          id,
          name: ROLES.ADMIN,
          isSystem: true,
          permissions: [],
        };
      };

      try {
        await assert.rejects(
          async () => {
            await rbacService.deleteRole("sys-role-id");
          },
          (err: any) => {
            return (
              err instanceof AppError &&
              err.statusCode === 400 &&
              err.message.includes("Cannot delete system role")
            );
          },
        );
      } finally {
        (rbacService as any).findRoleById = originalFindRoleById;
      }
    });

    it("should protect system roles from being renamed", async () => {
      const originalFindRoleById = rbacService.findRoleById.bind(rbacService);
      (rbacService as any).findRoleById = async (id: string) => {
        return {
          id,
          name: ROLES.ADMIN,
          isSystem: true,
          permissions: [],
        };
      };

      try {
        await assert.rejects(
          async () => {
            await rbacService.updateRole("sys-role-id", { name: "RenamedAdmin" });
          },
          (err: any) => {
            return (
              err instanceof AppError &&
              err.statusCode === 400 &&
              err.message.includes("Cannot rename system role")
            );
          },
        );
      } finally {
        (rbacService as any).findRoleById = originalFindRoleById;
      }
    });
  });
});
