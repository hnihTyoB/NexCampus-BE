import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.config';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';

export function extractTokenFromRequest(req: Request): string | undefined {
  let token = req.cookies?.accessToken;
  if (!token) {
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }
  // Only allow token in query string for SSE stream connections (EventSource in browsers does not support custom headers)
  const path = req.path || req.originalUrl || '';
  if (!token && req.query?.token && typeof req.query.token === 'string' && path.includes('/stream')) {
    token = req.query.token;
  }
  return token;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);

  if (!token) {
    next(new AppError('Unauthorized', 401, ERROR_CODE.UNAUTHORIZED));
    return;
  }

  try {
    const payload = jwt.verify(token, jwtConfig.accessSecret) as {
      id: string;
      email: string;
      role: string;
      roleId?: string;
    };

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      roleId: payload.roleId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401, ERROR_CODE.TOKEN_EXPIRED));
    } else {
      next(new AppError('Invalid token', 401, ERROR_CODE.TOKEN_INVALID));
    }
  }
}
