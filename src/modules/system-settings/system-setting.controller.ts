import { Request, Response, NextFunction } from "express";
import {
  systemSettingService,
  SystemSettingService,
} from "./system-setting.service";

export class SystemSettingController {
  constructor(private readonly service: SystemSettingService = systemSettingService) {}

  getSettings = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await this.service.getSettings();
      res.status(200).json({
        success: true,
        message: "Lấy cấu hình hệ thống thành công",
        data,
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
