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
      const body = (req.body && Object.keys(req.body).length > 0
        ? req.body
        : req.query) as unknown as UploadReportUrlInput;
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
        data: result.items,
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

  getVideoUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mimeType = (req.query.mimeType || req.query.contentType || "video/mp4") as string;
      const data = await this.service.getVideoUploadUrl(
        req.params.id,
        mimeType,
        req.user!,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  confirmVideoUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filePath } = req.body as { filePath: string };
      const data = await this.service.confirmVideoUpload(
        req.params.id,
        filePath,
        req.user!,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getAttachmentUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fileName = (req.query.fileName || "attachment") as string;
      const mimeType = (req.query.mimeType || req.query.contentType || "application/octet-stream") as string;
      const data = await this.service.getAttachmentUploadUrl(
        req.params.id || req.params.reportId,
        fileName,
        mimeType,
        req.user!,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  confirmAttachmentUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        filePath: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
      };
      const data = await this.service.confirmAttachmentUpload(
        req.params.id || req.params.reportId,
        body,
        req.user!,
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
