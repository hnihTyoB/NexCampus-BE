import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceGuard } from '../src/middlewares/maintenance.middleware';
import { maintenanceCacheService } from '../src/common/services/maintenance-cache.service';
import { permissionCacheService } from '../src/common/services/permission-cache.service';
import { PERMISSIONS } from '../src/common/constants/permission.constant';
import { ROLES } from '../src/common/constants/role.constant';
import { MAINTENANCE_STATUS } from '../src/common/constants/maintenance.constant';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';
import { enableMaintenanceSchema, updateMaintenanceSchema } from '../src/modules/maintenance/maintenance.validation';
import { MaintenanceService } from '../src/modules/maintenance/maintenance.service';
import { AUDIT_ACTION, AUDIT_TARGET_TYPE } from '../src/common/constants/audit-log.constant';

describe('System Maintenance Mode Module', () => {
  beforeEach(() => {
    maintenanceCacheService.clear();
    permissionCacheService.clear();
  });

  it('1. Maintenance disabled -> normal user can access API', async () => {
    const mockConfig: any = {
      id: 'conf-1',
      key: 'DEFAULT',
      enabled: false,
      status: MAINTENANCE_STATUS.ONLINE,
      title: 'Hệ thống đang bảo trì',
      message: 'Hệ thống đang được bảo trì để nâng cấp dịch vụ.',
      startAt: null,
      estimatedEndAt: null,
      bypassPermissions: [PERMISSIONS.MAINTENANCE_MANAGE, PERMISSIONS.MAINTENANCE_BYPASS],
      bypassRoles: [ROLES.ADMIN],
    };
    maintenanceCacheService.set(mockConfig);

    const guard = maintenanceGuard();
    const req: any = {
      originalUrl: '/api/v1/users',
      method: 'GET',
      user: {
        id: 'user-1',
        email: 'user@template.local',
        role: ROLES.USER,
        roleId: 'role-user-id',
      },
    };
    const res: any = {};
    let nextCalled = false;
    let nextError: any = null;

    await guard(req, res, (err) => {
      if (err) nextError = err;
      else nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(nextError, null);
  });

  it('2. Maintenance enabled -> normal user receives 503 Service Unavailable', async () => {
    const mockConfig: any = {
      id: 'conf-1',
      key: 'DEFAULT',
      enabled: true,
      status: MAINTENANCE_STATUS.MAINTENANCE,
      title: 'Bảo trì hệ thống định kỳ',
      message: 'Hệ thống tạm ngừng phục vụ để nâng cấp phiên bản 2.0.',
      startAt: new Date('2026-08-23T00:00:00Z'),
      estimatedEndAt: new Date('2026-08-23T04:00:00Z'),
      bypassPermissions: [PERMISSIONS.MAINTENANCE_MANAGE, PERMISSIONS.MAINTENANCE_BYPASS],
      bypassRoles: [ROLES.ADMIN],
    };
    maintenanceCacheService.set(mockConfig);

    const mockUserRoleId = 'user-role-uuid';
    (permissionCacheService as any).cache.set(mockUserRoleId, {
      permissions: new Set([PERMISSIONS.NOTIFICATION_READ]),
      expiresAt: Date.now() + 60000,
    });

    const guard = maintenanceGuard();
    const req: any = {
      originalUrl: '/api/v1/users',
      method: 'GET',
      user: {
        id: 'user-2',
        email: 'user@template.local',
        role: ROLES.USER,
        roleId: mockUserRoleId,
      },
    };
    const res: any = {};
    let nextError: any = null;

    await guard(req, res, (err) => {
      nextError = err;
    });

    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.statusCode, 503);
  });

  it('3. Maintenance enabled -> response code is SYSTEM_MAINTENANCE with structured data payload', async () => {
    const mockConfig: any = {
      id: 'conf-1',
      key: 'DEFAULT',
      enabled: true,
      status: MAINTENANCE_STATUS.MAINTENANCE,
      title: 'Bảo trì máy chủ',
      message: 'Đang bảo trì.',
      startAt: new Date('2026-08-23T00:00:00.000Z'),
      estimatedEndAt: new Date('2026-08-23T02:00:00.000Z'),
      bypassPermissions: [PERMISSIONS.MAINTENANCE_MANAGE],
      bypassRoles: [ROLES.ADMIN],
    };
    maintenanceCacheService.set(mockConfig);

    const guard = maintenanceGuard();
    const req: any = {
      originalUrl: '/api/v1/notifications',
      method: 'POST',
    };
    const res: any = {};
    let nextError: any = null;

    await guard(req, res, (err) => {
      nextError = err;
    });

    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.code, ERROR_CODE.SYSTEM_MAINTENANCE);
    assert.equal(nextError.data.title, 'Bảo trì máy chủ');
    assert.equal(nextError.data.message, 'Đang bảo trì.');
    assert.equal(nextError.data.estimatedEndAt, '2026-08-23T02:00:00.000Z');
  });

  it('4. Authorized user with MAINTENANCE_BYPASS or MAINTENANCE_MANAGE can access protected endpoints', async () => {
    const mockConfig: any = {
      id: 'conf-1',
      key: 'DEFAULT',
      enabled: true,
      status: MAINTENANCE_STATUS.MAINTENANCE,
      title: 'Bảo trì',
      message: 'Hệ thống bảo trì.',
      startAt: null,
      estimatedEndAt: null,
      bypassPermissions: [PERMISSIONS.MAINTENANCE_MANAGE, PERMISSIONS.MAINTENANCE_BYPASS],
      bypassRoles: [ROLES.ADMIN],
    };
    maintenanceCacheService.set(mockConfig);

    const devRoleId = 'dev-role-uuid';
    (permissionCacheService as any).cache.set(devRoleId, {
      permissions: new Set([PERMISSIONS.MAINTENANCE_BYPASS, PERMISSIONS.USER_READ]),
      expiresAt: Date.now() + 60000,
    });

    const guard = maintenanceGuard();
    const req: any = {
      originalUrl: '/api/v1/users',
      method: 'GET',
      user: {
        id: 'dev-1',
        email: 'dev@template.local',
        role: 'DEVELOPER',
        roleId: devRoleId,
      },
    };
    const res: any = {};
    let nextCalled = false;
    let nextError: any = null;

    await guard(req, res, (err) => {
      if (err) nextError = err;
      else nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(nextError, null);
  });

  it('5. Anti-Lockout: Health check, Auth endpoints and Maintenance module endpoints are never blocked', async () => {
    const mockConfig: any = {
      id: 'conf-1',
      key: 'DEFAULT',
      enabled: true,
      status: MAINTENANCE_STATUS.MAINTENANCE,
      title: 'Bảo trì',
      message: 'Bảo trì.',
      bypassPermissions: [PERMISSIONS.MAINTENANCE_MANAGE],
      bypassRoles: [ROLES.ADMIN],
    };
    maintenanceCacheService.set(mockConfig);

    const guard = maintenanceGuard();
    const exemptUrls = [
      '/health',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/maintenance/public',
      '/api/v1/maintenance/disable',
    ];

    for (const url of exemptUrls) {
      const req: any = { originalUrl: url, method: 'POST' };
      let passed = false;
      await guard(req, {} as any, (err) => {
        if (!err) passed = true;
      });
      assert.equal(passed, true, `URL ${url} should be exempt from maintenance lockout`);
    }
  });

  it('6. Read-Only Mode: Allows GET requests but blocks POST/PUT/DELETE mutations with 503', async () => {
    const mockConfig: any = {
      id: 'conf-1',
      key: 'DEFAULT',
      enabled: true,
      status: MAINTENANCE_STATUS.READ_ONLY,
      title: 'Hệ thống ở chế độ chỉ đọc',
      message: 'Hệ thống đang bảo trì dữ liệu, không nhận cập nhật mới.',
      bypassPermissions: [PERMISSIONS.MAINTENANCE_MANAGE],
      bypassRoles: [ROLES.ADMIN],
    };
    maintenanceCacheService.set(mockConfig);

    const guard = maintenanceGuard();

    // GET request should pass through
    const reqGet: any = { originalUrl: '/api/v1/users', method: 'GET' };
    let getPassed = false;
    await guard(reqGet, {} as any, (err) => {
      if (!err) getPassed = true;
    });
    assert.equal(getPassed, true);

    // POST request should be blocked
    const reqPost: any = { originalUrl: '/api/v1/users', method: 'POST' };
    let postError: any = null;
    await guard(reqPost, {} as any, (err) => {
      postError = err;
    });
    assert.ok(postError instanceof AppError);
    assert.equal(postError.statusCode, 503);
    assert.equal(postError.code, ERROR_CODE.SYSTEM_MAINTENANCE);
  });

  it('7. Validation schemas accurately validate enable & update maintenance payloads', () => {
    const validEnable = {
      title: 'Nâng cấp bảo mật',
      message: 'Hệ thống bảo trì trong 1 giờ',
      startAt: new Date().toISOString(),
      estimatedEndAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'MAINTENANCE',
      bypassPermissions: ['MAINTENANCE_MANAGE', 'MAINTENANCE_BYPASS'],
    };
    const enableResult = enableMaintenanceSchema.safeParse(validEnable);
    assert.equal(enableResult.success, true);

    const invalidDate = {
      title: 'Test',
      estimatedEndAt: 'not-a-valid-date',
    };
    const invalidResult = enableMaintenanceSchema.safeParse(invalidDate);
    assert.equal(invalidResult.success, false);

    const validUpdate = {
      enabled: false,
      status: 'ONLINE',
    };
    const updateResult = updateMaintenanceSchema.safeParse(validUpdate);
    assert.equal(updateResult.success, true);
  });

  it('8. Service correctly coordinates state changes, audit logging, and cache invalidation', async () => {
    const mockStoredConfig: any = {
      id: 'cfg-uuid-1',
      key: 'DEFAULT',
      enabled: false,
      status: MAINTENANCE_STATUS.ONLINE,
      title: 'Default Title',
      message: 'Default Message',
      startAt: null,
      estimatedEndAt: null,
      bypassPermissions: ['MAINTENANCE_MANAGE'],
      bypassRoles: ['ADMIN'],
    };

    let auditLogsCreated: any[] = [];
    let cacheInvalidated = false;

    const mockRepo: any = {
      getOrCreateDefaultConfig: async () => ({ ...mockStoredConfig }),
      updateConfig: async (key: string, data: any) => {
        Object.assign(mockStoredConfig, data);
        return { ...mockStoredConfig };
      },
      createAuditLog: async (log: any) => {
        auditLogsCreated.push(log);
        return log;
      },
    };

    const mockCache: any = {
      getConfig: async () => mockStoredConfig,
      invalidate: () => {
        cacheInvalidated = true;
      },
    };

    const service = new MaintenanceService(mockRepo, mockCache);

    // 1. Enable Maintenance
    const enabledConfig = await service.enableMaintenance(
      {
        title: 'Emergency Maintenance',
        message: 'Patching zero-day vulnerability',
      },
      { actorId: 'admin-id-123', ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0' },
    );

    assert.equal(enabledConfig.enabled, true);
    assert.equal(enabledConfig.status, MAINTENANCE_STATUS.MAINTENANCE);
    assert.equal(enabledConfig.title, 'Emergency Maintenance');
    assert.equal(cacheInvalidated, true);
    assert.equal(auditLogsCreated.length, 1);
    assert.equal(auditLogsCreated[0].action, AUDIT_ACTION.ENABLE_MAINTENANCE);
    assert.equal(auditLogsCreated[0].targetType, AUDIT_TARGET_TYPE.MAINTENANCE_CONFIG);
    assert.equal(auditLogsCreated[0].actorId, 'admin-id-123');

    // 2. Disable Maintenance
    cacheInvalidated = false;
    const disabledConfig = await service.disableMaintenance({
      actorId: 'admin-id-123',
    });

    assert.equal(disabledConfig.enabled, false);
    assert.equal(disabledConfig.status, MAINTENANCE_STATUS.ONLINE);
    assert.equal(cacheInvalidated, true);
    assert.equal(auditLogsCreated.length, 2);
    assert.equal(auditLogsCreated[1].action, AUDIT_ACTION.DISABLE_MAINTENANCE);
  });

  it('9. Error Middleware outputs exact standard 503 response shape with data payload', () => {
    const error = new AppError(
      'The system is currently under maintenance.',
      503,
      ERROR_CODE.SYSTEM_MAINTENANCE,
      {
        title: 'Bảo trì máy chủ định kỳ',
        message: 'The system is currently under maintenance.',
        estimatedEndAt: '2026-08-23T04:00:00.000Z',
      },
    );

    let responseStatus: number | null = null;
    let responseBody: any = null;

    const mockRes: any = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        return this;
      },
    };

    const { errorMiddleware } = require('../src/middlewares/error.middleware');
    errorMiddleware(error, {} as any, mockRes, (() => {}) as any);

    assert.equal(responseStatus, 503);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.code, 'SYSTEM_MAINTENANCE');
    assert.equal(responseBody.message, 'The system is currently under maintenance.');
    assert.deepEqual(responseBody.data, {
      title: 'Bảo trì máy chủ định kỳ',
      message: 'The system is currently under maintenance.',
      estimatedEndAt: '2026-08-23T04:00:00.000Z',
    });
  });

  it('10. Public status endpoint sanitizes sensitive metadata fields', async () => {
    const mockStoredConfig: any = {
      id: 'cfg-1',
      key: 'DEFAULT',
      enabled: true,
      status: MAINTENANCE_STATUS.MAINTENANCE,
      title: 'Public Title',
      message: 'Public Message',
      startAt: new Date('2026-08-23T00:00:00.000Z'),
      estimatedEndAt: new Date('2026-08-23T02:00:00.000Z'),
      bypassPermissions: ['MAINTENANCE_MANAGE', 'SUPER_SECRET_PERM'],
      bypassRoles: ['ADMIN'],
      metadata: { internalServerIp: '10.0.0.1' },
    };

    const mockCache: any = {
      getConfig: async () => mockStoredConfig,
    };

    const service = new MaintenanceService({} as any, mockCache);
    const publicStatus = await service.getPublicStatus();

    assert.equal(publicStatus.enabled, true);
    assert.equal(publicStatus.status, 'MAINTENANCE');
    assert.equal(publicStatus.title, 'Public Title');
    assert.equal(publicStatus.message, 'Public Message');
    assert.equal(publicStatus.startAt, '2026-08-23T00:00:00.000Z');
    assert.equal(publicStatus.estimatedEndAt, '2026-08-23T02:00:00.000Z');
    // Ensure sensitive fields are omitted
    assert.equal((publicStatus as any).bypassPermissions, undefined);
    assert.equal((publicStatus as any).bypassRoles, undefined);
    assert.equal((publicStatus as any).metadata, undefined);
    assert.equal((publicStatus as any).id, undefined);
  });

  it('11. Unauthorized user lacking MAINTENANCE_MANAGE cannot access maintenance management routes', async () => {
    const { requirePermission } = require('../src/middlewares/permission.middleware');
    const manageMiddleware = requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);

    const normalUserRoleId = 'role-normal-user-uuid';
    (permissionCacheService as any).cache.set(normalUserRoleId, {
      permissions: new Set([PERMISSIONS.USER_READ]),
      expiresAt: Date.now() + 60000,
    });

    const req: any = {
      user: {
        id: 'user-normal',
        email: 'user@template.local',
        role: ROLES.USER,
        roleId: normalUserRoleId,
      },
    };
    let nextError: any = null;

    await manageMiddleware(req, {} as any, (err: any) => {
      nextError = err;
    });

    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.statusCode, 403);
    assert.equal(nextError.code, ERROR_CODE.FORBIDDEN);
  });
});
