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
}
