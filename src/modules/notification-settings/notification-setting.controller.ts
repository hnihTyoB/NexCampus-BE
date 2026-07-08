import { Request, Response, NextFunction } from "express";
import { NotificationSettingService } from "./notification-setting.service";
import { UpdateNotificationSettingDto } from "./notification-setting.dto";

export class NotificationSettingController {
  private readonly service = new NotificationSettingService();

  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMe(req.user.id);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateNotificationSettingDto;
      const result = await this.service.updateMe(req.user.id, body);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
