import { Request, Response, NextFunction } from 'express';
import { IntegrationRepository } from '../modules/integration/integration.repository';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';
import { hashApiKey } from '../common/helpers/crypto.helper';
import { API_KEY_HEADER } from '../common/constants/integration.constant';

const integrationRepository = new IntegrationRepository();

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
    const apiKey = await integrationRepository.findApiKeyByKeyHash(keyHash);

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

    // Cập nhật lastUsedAt asynchronously có throttle (5 phút) tránh write-lock DB liên tục
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    if (!apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > FIVE_MINUTES_MS) {
      integrationRepository.updateApiKeyLastUsed(apiKey.id).catch(() => {});
    }


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
