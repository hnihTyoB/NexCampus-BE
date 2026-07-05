import { Request, Response, NextFunction } from 'express';
import { ReportAttachmentService } from './report-attachment.service';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

export class ReportAttachmentController {
  private readonly service = new ReportAttachmentService();

  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400, ERROR_CODE.VALIDATION_ERROR);
      }

      const { reportId } = req.params;
      const uploadedBy = req.user.id;
      const userRole = req.user.role;

      const attachment = await this.service.uploadAttachment(
        reportId,
        uploadedBy,
        userRole,
        req.file,
      );

      res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  };

  findByReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.params;
      const attachments = await this.service.findByReportId(reportId);

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

      res.json({ success: true, message: 'Report attachment deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
