import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { ListNotificationsDto, SendNotificationDto, BroadcastNotificationDto, ListEmailsDto } from './notification.dto';

export class NotificationController {
  private readonly service = new NotificationService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.query as unknown as ListNotificationsDto;
      const { items, total, page, limit, totalPages } = await this.service.list(req.user.id, dto);
      res.json({
        success: true,
        data: items,
        meta: { total, page, limit, totalPages },
      });
    } catch (error) {
      next(error);
    }
  };

  unreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getUnreadCount(req.user.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.markAsRead(req.user.id, req.params.id);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.markAllAsRead(req.user.id);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.user.id, req.params.id);
      res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
      next(error);
    }
  };

  send = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body as SendNotificationDto;
      const result = await this.service.send(dto);
      res.status(201).json({
        success: true,
        message: 'Notification dispatched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  broadcast = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body as BroadcastNotificationDto;
      const result = await this.service.broadcast(dto);
      res.status(201).json({
        success: true,
        message: 'Broadcast notification sent successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listEmails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.query as unknown as ListEmailsDto;
      const { items, total, page, limit, totalPages } = await this.service.listEmails(dto);
      res.json({
        success: true,
        data: items,
        meta: { total, page, limit, totalPages },
      });
    } catch (error) {
      next(error);
    }
  };

  retryEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.retryEmail(req.params.id);
      res.json({
        success: true,
        message: 'Email scheduled for retry',
      });
    } catch (error) {
      next(error);
    }
  };
}
