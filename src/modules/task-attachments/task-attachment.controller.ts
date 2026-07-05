import { Request, Response, NextFunction } from 'express';
import { TaskAttachmentService } from './task-attachment.service';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

export class TaskAttachmentController {
  private readonly service = new TaskAttachmentService();

  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400, ERROR_CODE.VALIDATION_ERROR);
      }

      const { taskId } = req.params;
      const uploadedBy = req.user.id;

      const attachment = await this.service.uploadAttachment(taskId, uploadedBy, req.file);

      res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  };

  findByTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const attachments = await this.service.findByTaskId(taskId);

      res.json({ success: true, data: attachments });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { attachmentId } = req.params;

      await this.service.deleteAttachment(attachmentId);

      res.json({ success: true, message: 'Attachment deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
