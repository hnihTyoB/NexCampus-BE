import { Request, Response, NextFunction } from "express";
import {
  discordWebhookManageService,
  DiscordWebhookManageService,
} from "./discord-webhook.service";

export class DiscordWebhookController {
  constructor(
    private readonly service: DiscordWebhookManageService = discordWebhookManageService,
  ) {}

  listWebhooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.service.listWebhooks(req.query as any);
      res.json({
        success: true,
        data: items,
      });
    } catch (err) {
      next(err);
    }
  };

  getWebhookById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const item = await this.service.getWebhookById(req.params["id"] as string);
      res.json({
        success: true,
        data: item,
      });
    } catch (err) {
      next(err);
    }
  };

  createOrUpdateWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const result = await this.service.createOrUpdateWebhook(req.body, {
        actorId,
        ipAddress,
        userAgent,
      });

      res.status(result.isCreated ? 201 : 200).json({
        success: true,
        message: result.isCreated
          ? "Tạo cấu hình Discord Webhook thành công"
          : "Cập nhật cấu hình Discord Webhook thành công",
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  };

  updateWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const item = await this.service.updateWebhook(
        req.params["id"] as string,
        req.body,
        { actorId, ipAddress, userAgent },
      );

      res.json({
        success: true,
        message: "Cập nhật cấu hình Discord Webhook thành công",
        data: item,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      await this.service.deleteWebhook(req.params["id"] as string, {
        actorId,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: "Xóa cấu hình Discord Webhook thành công",
      });
    } catch (err) {
      next(err);
    }
  };

  testPingWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const payload = {
        id: (req.params["id"] as string) || req.body?.id,
        webhookUrl: req.body?.webhookUrl,
        discordRoleId: req.body?.discordRoleId,
        channelName: req.body?.channelName,
      };

      const result = await this.service.testPingWebhook(payload, {
        actorId,
        ipAddress,
        userAgent,
      });

      res.json({
        success: result.success,
        message: result.message,
        data: {
          lastPingAt: result.lastPingAt,
          statusCode: result.statusCode,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getBotStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.service.getBotStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  };

  provisionDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const departmentId = req.params["id"] as string;
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const result = await this.service.provisionDepartment(departmentId, {
        actorId,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: "Khởi tạo Role & Private Thread trên Discord thành công",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  provisionAllDepartments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const result = await this.service.provisionAllDepartments({
        actorId,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: `Đã khởi tạo Discord cho ${result.succeeded}/${result.total} phòng ban thành công`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  batchSyncRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];
      const force = req.body?.force === true || req.query["force"] === "true";

      const result = await this.service.batchSyncRoles(
        { actorId, ipAddress, userAgent },
        { force },
      );

      res.json({
        success: true,
        message: `Đã hoàn tất đồng bộ Discord Roles: Cấp mới ${result.grantedCount}, Thu hồi ${result.revokedCount}, Đã đồng bộ ${result.alreadySyncedCount}, Thiếu ID ${result.missingIdCount}, Lỗi ${result.failedCount}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  remindUnlinkedDiscord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const result = await this.service.remindUnlinkedDiscord({
        actorId,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: `Đã gửi email nhắc nhở liên kết Discord tới ${result.sentCount}/${result.totalEligible} thực tập sinh`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  remindInternDiscord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const internId = req.params["id"] as string;
      const actorId = (req as any).user?.id;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const result = await this.service.remindInternDiscord(internId, {
        actorId,
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const discordWebhookController = new DiscordWebhookController();
