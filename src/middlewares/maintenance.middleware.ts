import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { maintenanceCacheService } from '../common/services/maintenance-cache.service';
import { permissionCacheService } from '../common/services/permission-cache.service';
import { jwtConfig } from '../config/jwt.config';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';
import { MAINTENANCE_STATUS } from '../common/constants/maintenance.constant';
import { isIpInWhitelist } from '../common/helpers/ip.helper';
import { extractTokenFromRequest } from './auth.middleware';

export interface MaintenanceGuardOptions {
  exemptPaths?: (string | RegExp)[];
}

const DEFAULT_EXEMPT_PATHS: (string | RegExp)[] = [
  '/health',
  /^\/api\/v1\/health/,
  /^\/api\/docs/,
  /^\/api\/v1\/maintenance/,
  /^\/api\/v1\/auth\/(login|refresh|logout|me|sessions)/,
  /^\/api\/v1\/system\/public/,
];


export function maintenanceGuard(options?: MaintenanceGuardOptions) {
  const exemptPaths = options?.exemptPaths ?? DEFAULT_EXEMPT_PATHS;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await maintenanceCacheService.getConfig();

      // If maintenance is not enabled and status is ONLINE, pass through
      if (!config.enabled && config.status === MAINTENANCE_STATUS.ONLINE) {
        return next();
      }

      // Check if current path is exempt
      const path = req.originalUrl || req.url || req.path;
      const isExempt = exemptPaths.some((pattern) => {
        if (typeof pattern === 'string') {
          return path.startsWith(pattern) || path === pattern;
        }
        return pattern.test(path);
      });

      if (isExempt) {
        return next();
      }

      // Check IP Whitelist Bypass (e.g. Developer VPN, QA office static IPs)
      const clientIp = req.ip || req.socket?.remoteAddress || '';
      const bypassIps = Array.isArray((config as any).bypassIps)
        ? ((config as any).bypassIps as string[])
        : [];

      if (bypassIps.length > 0 && isIpInWhitelist(clientIp, bypassIps)) {
        return next();
      }

      // Extract user if already populated or from token
      let user = req.user;

      if (!user) {
        const token = extractTokenFromRequest(req);

        if (token) {
          try {
            const payload = jwt.verify(token, jwtConfig.accessSecret) as {
              id: string;
              email: string;
              role: string;
              roleId?: string;
            };

            user = {
              id: payload.id,
              email: payload.email,
              role: payload.role as any,
              roleId: payload.roleId,
            };
            req.user = user;
          } catch {
            // Token is invalid/expired; user remains undefined
          }
        }
      }

      // If user is authenticated, check bypass permissions / roles
      if (user) {
        const bypassPermissions = Array.isArray(config.bypassPermissions)
          ? (config.bypassPermissions as string[])
          : ['MAINTENANCE_MANAGE', 'MAINTENANCE_BYPASS'];

        const bypassRoles = Array.isArray(config.bypassRoles)
          ? (config.bypassRoles as string[])
          : ['ADMIN'];

        // Role bypass
        if (user.role && bypassRoles.includes(user.role)) {
          return next();
        }

        // Permission bypass
        if (user.roleId) {
          const userPermissions = await permissionCacheService.getRolePermissions(user.roleId);
          req.user.permissions = Array.from(userPermissions);

          const hasBypassPermission = bypassPermissions.some((perm) => userPermissions.has(perm));
          if (hasBypassPermission) {
            return next();
          }
        }
      }

      // Handle READ_ONLY mode
      if (config.status === MAINTENANCE_STATUS.READ_ONLY) {
        const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
        const method = req.method ? req.method.toUpperCase() : 'GET';
        if (safeMethods.includes(method)) {
          return next();
        }
      }

      // Reject non-exempt / non-bypassed requests with 503
      next(
        new AppError(
          config.message || 'The system is currently under maintenance.',
          503,
          ERROR_CODE.SYSTEM_MAINTENANCE,
          {
            title: config.title,
            message: config.message,
            estimatedEndAt: config.estimatedEndAt ? config.estimatedEndAt.toISOString() : null,
            startAt: config.startAt ? config.startAt.toISOString() : null,
          },
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}
