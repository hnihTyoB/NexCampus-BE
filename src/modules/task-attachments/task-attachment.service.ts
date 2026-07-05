import { randomUUID } from 'crypto';
import { TaskAttachmentRepository } from './task-attachment.repository';
import { TaskRepository } from '../tasks/task.repository';
import { StorageService } from '../../common/services/storage.service';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { envConfig } from '../../config/env.config';

export class TaskAttachmentService {
  private readonly attachmentRepo = new TaskAttachmentRepository();
  private readonly taskRepo = new TaskRepository();
  private readonly storageService = new StorageService();

  private get bucket() {
    return envConfig.supabase.storageBucket;
  }

  async uploadAttachment(
    taskId: string,
    uploadedBy: string,
    file: Express.Multer.File,
  ) {
    // Kiem tra task ton tai
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // Tao duong dan duy nhat trong bucket: {taskId}/{uuid}_{originalname}
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${taskId}/${randomUUID()}_${safeFileName}`;

    // Upload len Supabase Storage
    const fileUrl = await this.storageService.uploadFile(
      this.bucket,
      filePath,
      file.buffer,
      file.mimetype,
    );

    // Luu record vao DB
    return this.attachmentRepo.create({
      taskId,
      fileName: file.originalname,
      fileUrl,
      filePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedBy,
    });
  }

  async deleteAttachment(attachmentId: string) {
    const attachment = await this.attachmentRepo.findById(attachmentId);

    if (!attachment) {
      throw new AppError('Attachment not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // Xoa file tren Supabase Storage truoc
    await this.storageService.deleteFile(this.bucket, attachment.filePath);

    // Xoa record trong DB
    await this.attachmentRepo.delete(attachmentId);
  }

  async findByTaskId(taskId: string) {
    return this.attachmentRepo.findByTaskId(taskId);
  }
}
