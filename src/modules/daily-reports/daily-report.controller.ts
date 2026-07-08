import { Request, Response, NextFunction } from "express";
import { DailyReportService } from "./daily-report.service";
import {
  DailyReportQueryDto,
  CreateDailyReportDto,
  UpdateDailyReportDto,
} from "./daily-report.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

export class DailyReportController {
  private readonly service = new DailyReportService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as DailyReportQueryDto;
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
      const user = req.user;
      const body = req.body as CreateDailyReportDto;
      const result = await this.service.create(body, user);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const body = req.body as UpdateDailyReportDto;
      const result = await this.service.update(req.params.id, body, user);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  uploadVideo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(
          "No file uploaded",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      const user = req.user;
      const { id } = req.params;

      const result = await this.service.uploadVideoDemo(id, req.file, user);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      await this.service.delete(req.params.id, user);

      res.json({ success: true, message: "Daily report deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
