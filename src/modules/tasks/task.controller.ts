import { Request, Response, NextFunction } from "express";
import { TaskService } from "./task.service";
import { TaskAnalyticsService } from "./task.analytics.service";
import { taskAllocationAiService } from "./task-allocation.ai.service";
import { ROLES } from "../../common/constants/role.constant";
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskQueryDto,
  ConfirmAttachmentUploadDto,
  CreateLinkAttachmentDto,
} from "./task.dto";

export class TaskController {
  private readonly service = new TaskService();
  private readonly analyticsService = new TaskAnalyticsService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findAll(
        req.query as unknown as TaskQueryDto,
        req.user,
      );
      res.json({ success: true, data: data.data, meta: data.meta });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findById(req.params.id, req.user);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(
        req.body as CreateTaskDto,
        req.user!.id,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.update(
        req.params.id,
        req.body as UpdateTaskDto,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id, req.user!, {
        ipAddress: req.ip,
      });
      res.json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  // ─── Attachments ────────────────────────────────────────────────────────────

  getAttachmentUploadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { fileName, contentType } = req.query as {
        fileName: string;
        contentType: string;
      };
      const result = await this.service.getAttachmentUploadUrl(
        req.params.taskId,
        fileName,
        contentType,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  confirmAttachment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.confirmAttachment(
        req.params.taskId,
        req.body as ConfirmAttachmentUploadDto,
        req.user!.id,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createLinkAttachment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createLinkAttachment(
        req.params.taskId,
        req.body as CreateLinkAttachmentDto,
        req.user!.id,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteAttachment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await this.service.deleteAttachment(
        req.params.taskId,
        req.params.attachmentId,
        req.user!.id,
        req.user?.role,
        { ipAddress: req.ip },
      );
      res.json({ success: true, message: "Attachment deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  findAttachments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.findAttachments(
        req.params.taskId,
        req.user,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  suggestAllocation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = taskAllocationAiService.evaluateAllocation(req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getAiRecommendation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.getAiRecommendation(
        req.params.id,
        req.user!,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getAnalytics = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const taskGroupId = (req.query.taskGroupId || req.body?.taskGroupId) as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const createdBy = req.user?.role === ROLES.LEADER ? req.user.id : undefined;
      const data = await this.analyticsService.getAll(
        taskGroupId,
        dateFrom,
        dateTo,
        createdBy,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
