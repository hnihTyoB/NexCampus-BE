import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.config";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { permissionCacheService } from "../common/services/permission-cache.service";

export function extractTokenFromRequest(req: Request): string | undefined {
  let token = req.cookies?.accessToken;
  if (!token) {
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }
  // Only allow token in query string for SSE stream connections (EventSource in browsers does not support custom headers)
  const path = req.path || req.originalUrl || "";
  if (
    !token &&
    req.query?.token &&
    typeof req.query.token === "string" &&
    (path.endsWith("/stream") || path.split("?")[0].endsWith("/stream"))
  ) {
    token = req.query.token;
  }
  return token;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractTokenFromRequest(req);

  if (!token) {
    next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
    return;
  }

  try {
    const payload = jwt.verify(token, jwtConfig.accessSecret) as {
      id: string;
      email: string;
      role: string;
      roleId?: string;
    };

    // Xác thực trạng thái người dùng (cached 60s) chống dùng JWT cũ khi tài khoản bị khóa hoặc xóa mềm
    const userState = await permissionCacheService.getUserState(payload.id);
    if (!userState || !userState.isActive || userState.deletedAt) {
      next(
        new AppError(
          "Tài khoản của bạn đã bị vô hiệu hóa hoặc không tồn tại",
          401,
          ERROR_CODE.UNAUTHORIZED,
        ),
      );
      return;
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: userState.roleName || payload.role,
      roleId: userState.roleId || payload.roleId,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError("Token expired", 401, ERROR_CODE.TOKEN_EXPIRED));
    } else {
      next(new AppError("Invalid token", 401, ERROR_CODE.TOKEN_INVALID));
    }
  }
}

/**
 * Middleware xác thực tùy chọn (Optional Auth).
 * Nếu có JWT hợp lệ thì gán req.user, nếu không có hoặc token sai thì bỏ qua và next()
 * không trả 401. Dùng cho các API public nhưng vẫn muốn context user nếu đã đăng nhập.
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractTokenFromRequest(req);

  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, jwtConfig.accessSecret) as {
      id: string;
      email: string;
      role: string;
      roleId?: string;
    };

    const userState = await permissionCacheService.getUserState(payload.id);
    if (userState && userState.isActive && !userState.deletedAt) {
      req.user = {
        id: payload.id,
        email: payload.email,
        role: userState.roleName || payload.role,
        roleId: userState.roleId || payload.roleId,
      };
    }
  } catch {
    // Bỏ qua lỗi token nếu là optional auth (xem như khách vãng lai)
  }

  next();
}
