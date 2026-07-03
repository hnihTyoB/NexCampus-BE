import { Request, Response, NextFunction } from 'express';
import { NotificationLogService } from './notification-log.service';
import { NotificationLogQueryDto, CreateNotificationLogDto, UpdateNotificationLogDto } from './notification-log.dto';

export class NotificationLogController {
  private readonly service = new NotificationLogService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as NotificationLogQueryDto;
      const result = await this.service.findAll(query, req.user);

      res.json({ success: true, ...result });
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

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateNotificationLogDto;
      const result = await this.service.create(body);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateNotificationLogDto;
      const result = await this.service.update(req.params.id, body);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);

      res.json({ success: true, message: 'Notification log deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
