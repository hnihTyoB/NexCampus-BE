import { Request, Response, NextFunction } from "express";
import { TaskService } from "./task.service";
import { TaskImportService } from "./task.import.service";
import { TaskAnalyticsService } from "./task.analytics.service";
import { TaskAllocationService } from "./task-allocation.service";
import { TaskQueryDto, CreateTaskDto, UpdateTaskDto } from "./task.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

export class TaskController {
  private readonly service = new TaskService();
  private readonly importService = new TaskImportService();
  private readonly analyticsService = new TaskAnalyticsService();
  private readonly allocationService = new TaskAllocationService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as TaskQueryDto;
      const result = await this.service.findAll(query);

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
      const createdBy = req.user.id;
      const body = req.body as CreateTaskDto;
      const result = await this.service.create(body, createdBy);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const body = req.body as UpdateTaskDto;
      const result = await this.service.update(req.params.id, body, actorId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      await this.service.delete(req.params.id, actorId);

      res.json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  previewImport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(
          "No file uploaded. Please upload an Excel file (.xlsx)",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      const taskGroupId = (req.body.taskGroupId || req.query.taskGroupId) as string | undefined;
      const taskGroupName = (req.body.taskGroupName || req.query.taskGroupName) as string | undefined;
      const result = await this.importService.preview(req.file.buffer, taskGroupId, taskGroupName);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  executeImport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(
          "No file uploaded. Please upload an Excel file (.xlsx)",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      const createdBy = req.user.id;
      const taskGroupId = (req.body.taskGroupId || req.query.taskGroupId) as string | undefined;
      const taskGroupName = (req.body.taskGroupName || req.query.taskGroupName) as string | undefined;
      const result = await this.importService.execute(req.file.buffer, createdBy, taskGroupId, taskGroupName);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  downloadTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = require("path");
      const fs = require("fs");
      const filePath = path.resolve(__dirname, "../../../templates/template_tasks.xlsx");

      if (!fs.existsSync(filePath)) {
        throw new AppError(
          "Không tìm thấy file mẫu template_tasks.xlsx trên máy chủ",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", "attachment; filename=template_tasks.xlsx");

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const taskGroupId = (req.query.taskGroupId || req.body.taskGroupId) as string | undefined;
      const result = await this.analyticsService.getAll(taskGroupId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getAiRecommendation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const taskId = req.params.taskId;
      const result = await this.allocationService.getAiRecommendation(taskId, req.user);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
