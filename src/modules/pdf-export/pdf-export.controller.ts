import { Request, Response, NextFunction } from "express";
import { PdfService } from "../../common/services/pdf.service";

export class PdfExportController {
  private pdfService = new PdfService();

  public exportWeeklyEvaluation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const fileUrl = await this.pdfService.generateWeeklyEvaluationReport(id, userId);

      res.status(200).json({
        success: true,
        message: "Xuất báo cáo PDF thành công",
        data: {
          fileUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
