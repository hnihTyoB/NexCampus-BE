import { Request, Response, NextFunction } from "express";
import {
  systemSettingService,
  SystemSettingService,
} from "./system-setting.service";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { permissionCacheService } from "../../common/services/permission-cache.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

export class SystemSettingController {
  constructor(private readonly service: SystemSettingService = systemSettingService) {}

  private async canManageSystemConfig(req: Request): Promise<boolean> {
    const userId = (req as any).user?.id;
    if (!userId) return false;
    try {
      const perms = await permissionCacheService.getUserPermissions(userId);
      return perms.includes(PERMISSIONS.SYSTEM_CONFIG_MANAGE);
    } catch {
      return false;
    }
  }

  getSettings = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const canManage = await this.canManageSystemConfig(req);
      const data = await this.service.getSettings();
      const sanitized: any = { ...data };

      // SEC: Chặn rò rỉ credential nhạy cảm cho người dùng không có quyền quản trị hệ thống
      if (!canManage) {
        delete sanitized.DISCORD_BOT_TOKEN;
      }

      res.status(200).json({
        success: true,
        message: "Lấy cấu hình hệ thống thành công",
        data: sanitized,
      });
    } catch (error) {
      next(error);
    }
  };

  getByKey = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { key } = req.params;

      // SEC: Chặn đọc trực tiếp bot token nếu không có quyền SYSTEM_CONFIG_MANAGE
      if (key === "DISCORD_BOT_TOKEN") {
        const canManage = await this.canManageSystemConfig(req);
        if (!canManage) {
          throw new AppError(
            "Bạn không có quyền truy cập cấu hình nhạy cảm này",
            403,
            ERROR_CODE.FORBIDDEN
          );
        }
      }

      const value = await this.service.getSetting(key);
      res.status(200).json({
        success: true,
        data: { key, value },
      });
    } catch (error) {
      next(error);
    }
  };

  updateSetting = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { key } = req.params;
      const { value, description, category } = req.body;
      const updated = await this.service.updateSetting(
        key,
        value,
        description,
        category
      );

      res.status(200).json({
        success: true,
        message: `Cập nhật cấu hình '${key}' thành công`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  batchUpdate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { settings } = req.body;
      const updated = await this.service.batchUpdate(settings);

      res.status(200).json({
        success: true,
        message: "Cập nhật cấu hình hàng loạt thành công",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const systemSettingController = new SystemSettingController();
