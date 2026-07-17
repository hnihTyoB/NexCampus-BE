import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service";
import { ReminderService } from "./reminder.service";
import {
  NotificationQueryDto,
  CreateNotificationDto,
} from "./notification.dto";

export class NotificationController {
  private readonly service = new NotificationService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as NotificationQueryDto;
      const result = await this.service.findAll(query, req.user);

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id, req.user);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateNotificationDto;
      const result = await this.service.create(body);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.markAsRead(req.params.id, req.user);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id, req.user);

      res.json({ success: true, message: "Notification deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  triggerTaskReminders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await ReminderService.remindTasks();
      res.json({
        success: true,
        message: "Task reminders triggered successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  triggerEvaluationReminders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await ReminderService.remindEvaluations();
      res.json({
        success: true,
        message: "Evaluation reminders triggered successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  sendCustom = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.sendCustom(req.body);
      res.status(201).json({
        success: true,
        message: "Custom notification dispatched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
