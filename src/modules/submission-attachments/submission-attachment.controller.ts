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
}
