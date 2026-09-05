import { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { permissionCacheService } from "../common/services/permission-cache.service";

async function resolveUserPermissions(req: Request): Promise<Set<string>> {
  if (!req.user) {
    throw new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED);
  }

  let roleId = req.user.roleId;

  // Xác thực trạng thái người dùng (cached 60s) để chống dùng JWT cũ khi bị khóa/hạ quyền
  // Bỏ qua khi request đã được xác thực qua API Key (đã có cơ chế kiểm tra riêng)
  if (!req.apiKey) {
    const currentUser = await permissionCacheService.getUserState(req.user.id);
    if (!currentUser || !currentUser.isActive || currentUser.deletedAt) {
      throw new AppError(
        "Tài khoản của bạn đã bị vô hiệu hóa hoặc không tồn tại",
        401,
        ERROR_CODE.UNAUTHORIZED,
      );
    }
    roleId = currentUser.roleId || undefined;
    req.user.roleId = roleId;
    if (currentUser.roleName) {
      req.user.role = currentUser.roleName;
    }
  }

  if (!roleId) {
    throw new AppError(
      "Forbidden: User role not found",
      403,
      ERROR_CODE.FORBIDDEN,
    );
  }

  const userPermissions =
    await permissionCacheService.getRolePermissions(roleId);

  // If request is authenticated via API Key, intersect role permissions with scoped API Key permissions
  if (req.apiKey && Array.isArray(req.user.permissions)) {
    const apiKeyPermissions = new Set(req.user.permissions);
    const effectivePermissions = new Set<string>();
    for (const perm of userPermissions) {
      if (apiKeyPermissions.has(perm)) {
        effectivePermissions.add(perm);
      }
    }
    req.user.permissions = Array.from(effectivePermissions);
    return effectivePermissions;
  }

  req.user.permissions = Array.from(userPermissions);
  return userPermissions;
}

/**
 * Middleware bắt buộc người dùng phải có TẤT CẢ các quyền được chỉ định.
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userPermissions = await resolveUserPermissions(req);

      const hasAllPermissions = requiredPermissions.every((perm) =>
        userPermissions.has(perm),
      );
      if (!hasAllPermissions) {
        next(
          new AppError(
            "Forbidden: Insufficient permissions",
            403,
            ERROR_CODE.FORBIDDEN,
          ),
        );
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
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userPermissions = await resolveUserPermissions(req);

      const hasAny = requiredPermissions.some((perm) =>
        userPermissions.has(perm),
      );
      if (!hasAny) {
        next(
          new AppError(
            "Forbidden: Insufficient permissions",
            403,
            ERROR_CODE.FORBIDDEN,
          ),
        );
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
