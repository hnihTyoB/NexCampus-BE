import { randomUUID } from "crypto";
import { ReportAttachmentRepository } from "./report-attachment.repository";
import { DailyReportRepository } from "../daily-reports/daily-report.repository";
import { InternRepository } from "../interns/intern.repository";
import { StorageService } from "../../common/services/storage.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { supabaseConfig } from "../../config/supabase.config";
import { ROLES } from "../../common/constants/role.constant";

export class ReportAttachmentService {
  private readonly attachmentRepo = new ReportAttachmentRepository();
  private readonly reportRepo = new DailyReportRepository();
  private readonly internRepository = new InternRepository();
  private readonly storageService = new StorageService();

  private get bucket() {
    return supabaseConfig.storageReportBucket;
  }

  async uploadAttachment(
    reportId: string,
    uploadedBy: string,
    userRole: string,
    file: Express.Multer.File,
  ) {
    // 1. Kiem tra report ton tai
    const report = await this.reportRepo.findById(reportId);
    if (!report) {
      throw new AppError("Daily report not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // 2. Kiem tra quyen so huu (neu la intern, chi duoc upload cho report cua minh)
    if (userRole === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(uploadedBy);
      if (!intern || report.internId !== intern.id) {
        throw new AppError(
          "You are not authorized to upload for this report",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // 2.5 Kiem tra gioi han 5 file dinh kem
    const existing = await this.attachmentRepo.findByReportId(reportId);
    if (existing.length >= 5) {
      throw new AppError(
        "Maximum 5 attachments allowed per daily report",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Tao duong dan duy nhat trong bucket: {reportId}/{uuid}_{originalname}
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${reportId}/${randomUUID()}_${safeFileName}`;

    // 4. Upload len Supabase Storage
    const fileUrl = await this.storageService.uploadFile(
      this.bucket,
      filePath,
      file.buffer,
      file.mimetype,
    );

    // 5. Luu record vao DB
    return this.attachmentRepo.create({
      reportId,
      fileName: file.originalname,
      fileUrl,
      filePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedBy,
    });
  }

  async deleteAttachment(
    attachmentId: string,
    userId: string,
    userRole: string,
  ) {
    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment) {
      throw new AppError("Attachment not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // Lay report de check quyen
    const report = await this.reportRepo.findById(attachment.reportId);
    if (!report) {
      throw new AppError("Daily report not found", 404, ERROR_CODE.NOT_FOUND);
    }

    // Intern chi duoc xoa attachment cua minh
    if (userRole === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(userId);
      if (!intern || report.internId !== intern.id) {
        throw new AppError(
          "You are not authorized to delete this attachment",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // Xoa file tren Supabase Storage
    await this.storageService.deleteFile(this.bucket, attachment.filePath);

    // Xoa record trong DB
    await this.attachmentRepo.delete(attachmentId);
  }

  async findByReportId(reportId: string) {
    return this.attachmentRepo.findByReportId(reportId);
  }
}
