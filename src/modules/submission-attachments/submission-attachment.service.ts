import { randomUUID } from "crypto";
import { SubmissionAttachmentRepository } from "./submission-attachment.repository";
import { TaskSubmissionRepository } from "../task-submissions/task-submission.repository";
import { StorageService } from "../../common/services/storage.service";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { supabaseConfig } from "../../config/supabase.config";
import { ROLES } from "../../common/constants/role.constant";
import { REVIEW_STATUS } from "../../common/constants/status.constant";

export class SubmissionAttachmentService {
  private readonly attachmentRepo = new SubmissionAttachmentRepository();
  private readonly submissionRepo = new TaskSubmissionRepository();
  private readonly storageService = new StorageService();

  private get bucket() {
    return supabaseConfig.storageSubmissionBucket;
  }

  async uploadAttachment(
    submissionId: string,
    uploadedBy: string,
    userRole: string,
    file: Express.Multer.File,
  ) {
    // 1. Kiem tra submission ton tai
    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission) {
      throw new AppError(
        "Task submission not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // 2. Kiem tra quyen so huu (neu la intern, chi duoc upload cho submission cua minh)
    if (
      userRole === ROLES.INTERN &&
      (!submission.assignment || !submission.assignment.intern || submission.assignment.intern.userId !== uploadedBy)
    ) {
      throw new AppError(
        "You are not authorized to upload for this submission",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    // 2.5 Kiem tra gioi han 5 file dinh kem
    const existing = await this.attachmentRepo.findBySubmissionId(submissionId);
    if (existing.length >= 5) {
      throw new AppError(
        "Maximum 5 attachments allowed per submission",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 3. Kiem tra trang thai (khong cho phep upload khi da duoc APPROVED)
    if (submission.reviewStatus === REVIEW_STATUS.APPROVED) {
      throw new AppError(
        "Cannot upload attachments for an approved submission",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    // 4. Tao duong dan duy nhat trong bucket: {submissionId}/{uuid}_{originalname}
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${submissionId}/${randomUUID()}_${safeFileName}`;

    // 5. Upload len Supabase Storage
    const fileUrl = await this.storageService.uploadFile(
      this.bucket,
      filePath,
      file.buffer,
      file.mimetype,
    );

    // 6. Luu record vao DB
    return this.attachmentRepo.create({
      submissionId,
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

    // Lay submission de check quyen va trang thai
    const submission = await this.submissionRepo.findById(
      attachment.submissionId,
    );
    if (!submission) {
      throw new AppError(
        "Task submission not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // Intern chi duoc xoa attachment cua minh
    if (userRole === ROLES.INTERN) {
      if (!submission.assignment || !submission.assignment.intern || submission.assignment.intern.userId !== userId) {
        throw new AppError(
          "You are not authorized to delete this attachment",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
      // Intern khong duoc xoa neu submission da APPROVED
      if (submission.reviewStatus === REVIEW_STATUS.APPROVED) {
        throw new AppError(
          "Cannot delete attachments for an approved submission",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
    }

    // Xoa file tren Supabase Storage
    await this.storageService.deleteFile(this.bucket, attachment.filePath);

    // Xoa record trong DB
    await this.attachmentRepo.delete(attachmentId);
  }

  async findBySubmissionId(submissionId: string) {
    return this.attachmentRepo.findBySubmissionId(submissionId);
  }
}
