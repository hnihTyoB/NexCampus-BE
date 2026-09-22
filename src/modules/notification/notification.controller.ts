import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service";
import { sseManagerService } from "../../common/services/sse-manager.service";
import { sseTicketService } from "../../common/services/sse-ticket.service";
import {
  ListNotificationsDto,
  SendNotificationDto,
  BroadcastNotificationDto,
  ListEmailsDto,
  ListNotificationTemplatesDto,
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
  PreviewNotificationTemplateDto,
  TestSendNotificationTemplateDto,
} from "./notification.dto";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE,
} from "../../common/constants/notification.constant";

export class NotificationController {
  private readonly service = new NotificationService();

  getTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await sseTicketService.createTicket({
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        roleId: req.user.roleId,
      });
      res.json({ success: true, ticket });
    } catch (error) {
      next(error);
    }
  };

  stream = (req: Request, res: Response): void => {
    sseManagerService.registerClient(req.user.id, res, req);
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.query as unknown as ListNotificationsDto;
      const { items, total, page, limit, totalPages } = await this.service.list(
        req.user.id,
        dto,
      );
      res.json({
        success: true,
        data: items,
        meta: { total, page, limit, totalPages },
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await this.service.getById(req.user.id, req.params.id);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  };

  unreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getUnreadCount(req.user.id);
      res.json({
        success: true,
        data: result,
        count: result.unreadCount,
      });
    } catch (error) {
      next(error);
    }
  };

  getActionCounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getActionCounts(req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.markAsRead(req.user.id, req.params.id);
      res.json({ success: true, message: "Notification marked as read" });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.markAllAsRead(req.user.id);
      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.user.id, req.params.id);
      res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
      next(error);
    }
  };

  clearRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.clearRead(req.user.id);
      res.json({
        success: true,
        message: "Read notifications cleared successfully",
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

  createLegacyNotification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { userId, title, content, type } = req.body;
      const result = await this.service.send({
        userIds: [userId],
        channels: [NOTIFICATION_CHANNEL.WEB],
        title,
        content,
        type: type || NOTIFICATION_TYPE.INFO,
      });
      res.status(201).json({
        success: true,
        message: "Notification created successfully",
        data: result,
      });
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
        message: "Notification dispatched successfully",
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
        message: "Broadcast notification sent successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listEmails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.query as unknown as ListEmailsDto;
      const { items, total, page, limit, totalPages } =
        await this.service.listEmails(dto);
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
        message: "Email scheduled for retry",
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────
  // Template Controller Handlers
  // ─────────────────────────────────────────────

  listTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.query as unknown as ListNotificationTemplatesDto;
      const { items, total, page, limit, totalPages } =
        await this.service.listTemplates(dto);
      res.json({
        success: true,
        data: items,
        meta: { total, page, limit, totalPages },
      });
    } catch (error) {
      next(error);
    }
  };

  getTemplateByCode = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const template = await this.service.getTemplateByCode(req.params.code);
      res.json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  };

  createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body as CreateNotificationTemplateDto;
      const template = await this.service.createTemplate(dto, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json({
        success: true,
        message: "Notification template created successfully",
        data: template,
      });
    } catch (error) {
      next(error);
    }
  };

  updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body as UpdateNotificationTemplateDto;
      const template = await this.service.updateTemplate(req.params.id, dto, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({
        success: true,
        message: "Notification template updated successfully",
        data: template,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteTemplate(req.params.id, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({
        success: true,
        message: "Notification template deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  previewTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body as PreviewNotificationTemplateDto;
      const preview = await this.service.previewTemplate(req.params.code, dto);
      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  };

  testSendTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const dto = req.body as TestSendNotificationTemplateDto;
      const result = await this.service.testSendTemplate(
        req.params.code,
        req.user.id,
        dto,
      );
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };
}
