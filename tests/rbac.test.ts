import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { requirePermission, requireAnyPermission } from '../src/middlewares/permission.middleware';
import { permissionCacheService } from '../src/common/services/permission-cache.service';
import { PERMISSIONS } from '../src/common/constants/permission.constant';
import { ROLES } from '../src/common/constants/role.constant';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('Dynamic RBAC Permission Middleware', () => {
  beforeEach(() => {
    permissionCacheService.clear();
  });

  it('should deny unauthenticated requests with 401 Unauthorized', async () => {
    const middleware = requirePermission(PERMISSIONS.USER_READ);
    const req = {} as any;
    const res = {} as any;
    let nextError: any = null;

    await middleware(req, res, (err) => {
      nextError = err;
    });

    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.statusCode, 401);
    assert.equal(nextError.code, ERROR_CODE.UNAUTHORIZED);
  });

  it('should grant access when user role possesses required permission', async () => {
    const middleware = requirePermission(PERMISSIONS.USER_READ);
    const mockRoleId = '11111111-1111-1111-1111-111111111111';

    // Mock cache to simulate role with permissions
    (permissionCacheService as any).cache.set(mockRoleId, {
      permissions: new Set([PERMISSIONS.USER_READ, PERMISSIONS.USER_CREATE]),
      expiresAt: Date.now() + 60000,
    });

    const req = {
      user: {
        id: 'user-1',
        email: 'admin@template.local',
        role: ROLES.ADMIN,
        roleId: mockRoleId,
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
    assert.ok(req.user.permissions.includes(PERMISSIONS.USER_READ));
  });

  it('should deny access with 403 Forbidden when user role lacks required permission', async () => {
    const middleware = requirePermission(PERMISSIONS.ROLE_DELETE);
    const mockRoleId = '22222222-2222-2222-2222-222222222222';

    // Mock cache with read-only user permissions
    (permissionCacheService as any).cache.set(mockRoleId, {
      permissions: new Set([PERMISSIONS.NOTIFICATION_READ]),
      expiresAt: Date.now() + 60000,
    });

    const req = {
      user: {
        id: 'user-2',
        email: 'user@template.local',
        role: ROLES.USER,
        roleId: mockRoleId,
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

  it('should support requireAnyPermission when at least one permission matches', async () => {
    const middleware = requireAnyPermission(PERMISSIONS.USER_READ, PERMISSIONS.ROLE_READ);
    const mockRoleId = '33333333-3333-3333-3333-333333333333';

    (permissionCacheService as any).cache.set(mockRoleId, {
      permissions: new Set([PERMISSIONS.ROLE_READ]),
      expiresAt: Date.now() + 60000,
    });

    const req = {
      user: {
        id: 'user-3',
        email: 'manager@template.local',
        role: ROLES.MANAGER,
        roleId: mockRoleId,
      },
    } as any;
    const res = {} as any;
    let nextCalled = false;

    await middleware(req, res, (err) => {
      if (!err) nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  it('should accurately invalidate role permission cache upon mutation', () => {
    const mockRoleId = '44444444-4444-4444-4444-444444444444';
    (permissionCacheService as any).cache.set(mockRoleId, {
      permissions: new Set([PERMISSIONS.USER_READ]),
      expiresAt: Date.now() + 60000,
    });

    assert.ok((permissionCacheService as any).cache.has(mockRoleId));

    permissionCacheService.invalidateRole(mockRoleId);

    assert.equal((permissionCacheService as any).cache.has(mockRoleId), false);
  });
});
