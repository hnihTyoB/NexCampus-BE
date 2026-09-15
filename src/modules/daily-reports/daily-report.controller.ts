import { Request, Response, NextFunction } from "express";
import { DailyReportService } from "./daily-report.service";
import {
  CalendarDailyReportInput,
  CreateDailyReportInput,
  FeedbackDailyReportInput,
  QueryDailyReportInput,
  UpdateDailyReportInput,
  UploadReportUrlInput,
} from "./daily-report.validation";

export class DailyReportController {
  private readonly service = new DailyReportService();

  submitReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateDailyReportInput;
      const result = await this.service.submitReport(body, req.user!, {
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UploadReportUrlInput;
      const result = await this.service.getUploadUrl(body, req.user!);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as QueryDailyReportInput;
      const result = await this.service.findAll(query, req.user!);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getCalendar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as CalendarDailyReportInput;
      const result = await this.service.getCalendar(query, req.user!);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id, req.user!);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateDailyReportInput;
      const result = await this.service.update(req.params.id, body, req.user!, {
        ipAddress: req.ip,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.delete(req.params.id, req.user!, {
        ipAddress: req.ip,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  addFeedback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as FeedbackDailyReportInput;
      const result = await this.service.addFeedback(
        req.params.id,
        body.feedback,
        req.user!,
        { ipAddress: req.ip },
      );

      res.status(200).json({
        success: true,
        data: result,
      });
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
      const result = await this.service.deleteAttachment(
        req.params.attachmentId,
        req.user!,
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
