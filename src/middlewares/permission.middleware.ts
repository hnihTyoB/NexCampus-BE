import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';
import { permissionCacheService } from '../common/services/permission-cache.service';
import { prisma } from '../database/prisma.client';

export function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next(new AppError('Unauthorized', 401, ERROR_CODE.UNAUTHORIZED));
        return;
      }

      let roleId = req.user.roleId;

      // Fallback: If roleId was not in JWT payload, fetch it from database
      if (!roleId) {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { roleId: true },
        });

        if (!user || !user.roleId) {
          next(new AppError('Forbidden: User role not found', 403, ERROR_CODE.FORBIDDEN));
          return;
        }

        roleId = user.roleId;
        req.user.roleId = roleId;
      }

      const userPermissions = await permissionCacheService.getRolePermissions(roleId);
      req.user.permissions = Array.from(userPermissions);

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every((perm) => userPermissions.has(perm));

      if (!hasAllPermissions) {
        next(new AppError('Forbidden: Insufficient permissions', 403, ERROR_CODE.FORBIDDEN));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAnyPermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next(new AppError('Unauthorized', 401, ERROR_CODE.UNAUTHORIZED));
        return;
      }

      let roleId = req.user.roleId;

      if (!roleId) {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { roleId: true },
        });

        if (!user || !user.roleId) {
          next(new AppError('Forbidden: User role not found', 403, ERROR_CODE.FORBIDDEN));
          return;
        }

        roleId = user.roleId;
        req.user.roleId = roleId;
      }

      const userPermissions = await permissionCacheService.getRolePermissions(roleId);
      req.user.permissions = Array.from(userPermissions);

      const hasAny = requiredPermissions.some((perm) => userPermissions.has(perm));

      if (!hasAny) {
        next(new AppError('Forbidden: Insufficient permissions', 403, ERROR_CODE.FORBIDDEN));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
