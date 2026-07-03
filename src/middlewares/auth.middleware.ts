import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.config';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Unauthorized', 401, ERROR_CODE.UNAUTHORIZED));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, jwtConfig.accessSecret) as {
      id: string;
      email: string;
      role: string;
    };

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role as any,
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
