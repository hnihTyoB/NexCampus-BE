import { Request, Response, NextFunction } from 'express';
import { systemConfigService } from '../modules/system-config/system-config.service';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';

export interface FeatureFlagOptions {
  defaultState?: boolean;
  message?: string;
}

/**
 * Middleware bảo vệ route dựa trên trạng thái động của Feature Flag.
 * Nếu cờ tính năng bị tắt, trả về lỗi 403 Forbidden kèm mã ERROR_CODE.FEATURE_DISABLED.
 */
export function requireFeatureFlag(flagKey: string, options: FeatureFlagOptions = {}) {
  const defaultState = options.defaultState ?? true;
  const message = options.message ?? `Feature '${flagKey}' is currently disabled by administrator`;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isEnabled = await systemConfigService.isFeatureEnabled(flagKey, defaultState);

      if (!isEnabled) {
        next(new AppError(message, 403, ERROR_CODE.FEATURE_DISABLED));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
