import { Request, Response, NextFunction } from "express";
import { TaskAttachmentService } from "./task-attachment.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

export class TaskAttachmentController {
  private readonly service = new TaskAttachmentService();

  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        throw new AppError(
          "No file uploaded",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      const { taskId } = req.params;
      const uploadedBy = req.user.id;

      const results = await Promise.allSettled(
        files.map((file) => this.service.uploadAttachment(taskId, uploadedBy, file)),
      );

      const data = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<unknown>).value);
      const failedCount = results.filter((r) => r.status === "rejected").length;

      res.status(201).json({ success: true, data, failedCount });
    } catch (error) {
      next(error);
    }
  };

  findByTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const attachments = await this.service.findByTaskId(taskId, req.user.id, req.user.role);

      res.json({ success: true, data: attachments });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { attachmentId } = req.params;

      await this.service.deleteAttachment(attachmentId, req.user.id, req.user.role);

      res.json({ success: true, message: "Attachment deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  createLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const { fileName, fileUrl } = req.body;
      const uploadedBy = req.user.id;

      if (!fileName || !fileUrl) {
        throw new AppError(
          "fileName and fileUrl are required",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      const attachment = await this.service.createLinkAttachment(
        taskId,
        uploadedBy,
        fileName,
        fileUrl,
      );

      res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  };

  getPutUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const { fileName, mimeType, fileSize } = req.query as {
        fileName?: string;
        mimeType?: string;
        fileSize?: string;
      };
      if (!fileName || !mimeType || !fileSize) {
        throw new AppError(
          "fileName, mimeType, fileSize query params are required",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      const result = await this.service.getPutUrl(
        taskId,
        fileName,
        mimeType,
        parseInt(fileSize, 10),
        req.user.id,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  confirmUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const { filePath, fileName, mimeType, fileSize } = req.body as {
        filePath?: string;
        fileName?: string;
        mimeType?: string;
        fileSize?: number;
      };
      if (!filePath || !fileName || !mimeType || fileSize === undefined) {
        throw new AppError(
          "filePath, fileName, mimeType, fileSize are required",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      const result = await this.service.confirmUpload(
        taskId,
        filePath,
        fileName,
        mimeType,
        fileSize,
        req.user.id,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
