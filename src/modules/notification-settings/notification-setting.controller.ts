import { Request, Response, NextFunction } from "express";
import { NotificationSettingService } from "./notification-setting.service";
import { UpdateNotificationSettingInput } from "./notification-setting.validation";

export class NotificationSettingController {
  private readonly service = new NotificationSettingService();

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getSettings(req.user!.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const body = req.body as UpdateNotificationSettingInput;
      const result = await this.service.updateSettings(
        req.user!.id,
        body,
        { ipAddress: req.ip },
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
