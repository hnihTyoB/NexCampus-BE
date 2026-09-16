import { Request, Response, NextFunction } from "express";
import { pdfExportService, PdfExportService } from "./pdf-export.service";

export class PdfExportController {
  constructor(private readonly service: PdfExportService = pdfExportService) {}

  exportWeeklyEvaluation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.exportWeeklyEvaluation(id, req.user);

      res.status(200).json({
        success: true,
        message: "Xuất phiếu đánh giá tuần PDF thành công",
        data: {
          fileUrl: result.downloadUrl,
          fileName: result.fileName,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  exportInternshipSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { internId } = req.params;
      const result = await this.service.exportInternshipSummary(
        internId,
        req.user
      );

      res.status(200).json({
        success: true,
        message: "Xuất bảng tổng hợp kết quả thực tập PDF thành công",
        data: {
          fileUrl: result.downloadUrl,
          fileName: result.fileName,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const pdfExportController = new PdfExportController();
