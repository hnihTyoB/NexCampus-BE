import { Request, Response, NextFunction } from "express";
import { SystemSettingService } from "./system-setting.service";

export class SystemSettingController {
  private readonly service = new SystemSettingService();

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getSettings();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateSetting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key, value } = req.body;
      const result = await this.service.updateSetting(key, String(value));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
