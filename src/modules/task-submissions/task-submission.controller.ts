import { Request, Response, NextFunction } from "express";
import { TaskSubmissionService } from "./task-submission.service";
import {
  CreateTaskSubmissionDto,
  ReviewSubmissionDto,
  CreateAttachmentInput,
  TaskSubmissionQueryDto,
} from "./task-submission.dto";

export class TaskSubmissionController {
  private readonly service = new TaskSubmissionService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findAll(
        req.query as unknown as TaskSubmissionQueryDto,
        req.user!,
      );
      res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findById(req.params.id, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(
        req.body as CreateTaskSubmissionDto,
        req.user!,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.review(
        req.params.id,
        req.body as ReviewSubmissionDto,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileName, mimeType } = req.query as {
        fileName: string;
        mimeType: string;
      };
      const data = await this.service.getUploadUrl(
        fileName,
        mimeType,
        req.user!,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  addAttachment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.addAttachment(
        req.params.id,
        req.body as CreateAttachmentInput,
        req.user!,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteAttachment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteAttachment(
        req.params.id,
        req.params.attachmentId,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, message: "Attachment deleted successfully" });
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
        { ipAddress: req.ip },
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
        req.params.id || req.params.submissionId,
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
        req.params.id || req.params.submissionId,
        body,
        req.user!,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
