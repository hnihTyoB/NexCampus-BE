import { Request, Response, NextFunction } from "express";
import { NotificationTemplateService } from "./notification-template.service";
import { UpdateNotificationTemplateDto } from "./notification-template.dto";

export class NotificationTemplateController {
  private readonly service = new NotificationTemplateService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findAll();

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateNotificationTemplateDto;
      const result = await this.service.update(req.params.id, body);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
