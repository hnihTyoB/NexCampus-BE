import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';
import { permissionCacheService } from '../common/services/permission-cache.service';
import { prisma } from '../database/prisma.client';

/**
 * Trích xuất và giải quyết danh sách quyền (Set<string>) của người dùng từ cache/database.
 */
async function resolveUserPermissions(req: Request): Promise<Set<string>> {
  if (!req.user) {
    throw new AppError('Unauthorized', 401, ERROR_CODE.UNAUTHORIZED);
  }

  let roleId = req.user.roleId;

  // Fallback: Nếu roleId chưa có trong JWT payload, truy vấn từ database
  if (!roleId) {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { roleId: true },
    });

    if (!user || !user.roleId) {
      throw new AppError('Forbidden: User role not found', 403, ERROR_CODE.FORBIDDEN);
    }

    roleId = user.roleId;
    req.user.roleId = roleId;
  }

  const userPermissions = await permissionCacheService.getRolePermissions(roleId);
  req.user.permissions = Array.from(userPermissions);
  return userPermissions;
}

/**
 * Middleware bắt buộc người dùng phải có TẤT CẢ các quyền được chỉ định.
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userPermissions = await resolveUserPermissions(req);

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

/**
 * Middleware bắt buộc người dùng phải có ÍT NHẤT MỘT trong các quyền được chỉ định.
 */
export function requireAnyPermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userPermissions = await resolveUserPermissions(req);

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
