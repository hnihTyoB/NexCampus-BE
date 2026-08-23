import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma.client';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';
import { hashApiKey } from '../common/helpers/crypto.helper';
import { API_KEY_HEADER } from '../common/constants/integration.constant';

export async function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  let key = req.headers[API_KEY_HEADER] as string | undefined;

  if (!key) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ak_')) {
      key = authHeader.split(' ')[1];
    }
  }

  if (!key) {
    next(new AppError('API Key is required in X-API-Key header or Bearer token', 401, ERROR_CODE.UNAUTHORIZED));
    return;
  }

  try {
    const keyHash = hashApiKey(key);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          include: { role: true },
        },
      },
    });

    if (!apiKey || !apiKey.isActive) {
      next(new AppError('Invalid or deactivated API Key', 401, ERROR_CODE.UNAUTHORIZED));
      return;
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      next(new AppError('API Key has expired', 401, ERROR_CODE.TOKEN_EXPIRED));
      return;
    }

    if (!apiKey.user || !apiKey.user.isActive) {
      next(new AppError('API Key owner account is inactive', 403, ERROR_CODE.USER_INACTIVE));
      return;
    }

    // Cập nhật lastUsedAt asynchronously không block request
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    // Gán thông tin user sở hữu API Key vào request
    req.user = {
      id: apiKey.user.id,
      email: apiKey.user.email || '',
      role: apiKey.user.role.name,
      roleId: apiKey.user.roleId,
      permissions: (apiKey.permissions as string[]) || [],
    };

    (req as any).apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
    };

    next();
  } catch (error) {
    next(error);
  }
}
