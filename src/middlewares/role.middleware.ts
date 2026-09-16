import { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

/**
 * Middleware kiểm tra vai trò người dùng (Role-based access control)
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.role) {
      next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
      return;
    }

    const userRole = req.user.role.toUpperCase();
    const hasRole = allowedRoles.some((r) => r.toUpperCase() === userRole);

    if (!hasRole) {
      next(
        new AppError(
          "Forbidden: Insufficient role permissions",
          403,
          ERROR_CODE.FORBIDDEN
        )
      );
      return;
    }

    next();
  };
}
