import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.config";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { prisma } from "../database/prisma.client";
import { Role } from "../common/constants/role.constant";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, jwtConfig.accessSecret) as {
      id: string;
      email: string;
      role: string;
    };

    const user = await prisma.user.findFirst({
      where: { id: payload.id, deletedAt: null },
      select: { isActive: true },
    });

    if (!user) {
      next(new AppError("User not found", 401, ERROR_CODE.UNAUTHORIZED));
      return;
    }

    if (!user.isActive) {
      next(new AppError("Account is inactive", 403, ERROR_CODE.USER_INACTIVE));
      return;
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role as Role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError("Token expired", 401, ERROR_CODE.TOKEN_EXPIRED));
    } else {
      next(new AppError("Invalid token", 401, ERROR_CODE.TOKEN_INVALID));
    }
  }
}

export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, jwtConfig.accessSecret) as {
      id: string;
      email: string;
      role: string;
    };

    const user = await prisma.user.findFirst({
      where: { id: payload.id, deletedAt: null },
      select: { isActive: true },
    });

    if (user && user.isActive) {
      req.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role as Role,
      };
    }
  } catch (error) {
    // optional auth does not block the request
  }
  next();
}
