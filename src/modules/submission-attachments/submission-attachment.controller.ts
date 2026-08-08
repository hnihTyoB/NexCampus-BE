import { Request, Response, NextFunction } from "express";
import { SubmissionAttachmentService } from "./submission-attachment.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

export class SubmissionAttachmentController {
  private readonly service = new SubmissionAttachmentService();

  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(
          "No file uploaded",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }

      const { submissionId } = req.params;
      const uploadedBy = req.user.id;
      const userRole = req.user.role;

      const attachment = await this.service.uploadAttachment(
        submissionId,
        uploadedBy,
        userRole,
        req.file,
      );

      res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  };

  findBySubmission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { submissionId } = req.params;
      const attachments = await this.service.findBySubmissionId(submissionId);

      res.json({ success: true, data: attachments });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { attachmentId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      await this.service.deleteAttachment(attachmentId, userId, userRole);

      res.json({
        success: true,
        message: "Submission attachment deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getPutUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { submissionId } = req.params;
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
        submissionId,
        fileName,
        mimeType,
        parseInt(fileSize, 10),
        req.user.id,
        req.user.role,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  confirmUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { submissionId } = req.params;
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
        submissionId,
        filePath,
        fileName,
        mimeType,
        fileSize,
        req.user.id,
        req.user.role,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
