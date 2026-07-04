import { prisma } from '../../database/prisma.client';

export class TaskAttachmentRepository {
  findByTaskId(taskId: string) {
    return prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return prisma.taskAttachment.findUnique({ where: { id } });
  }

  create(data: {
    taskId: string;
    fileName: string;
    fileUrl: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedBy: string;
  }) {
    return prisma.taskAttachment.create({ data });
  }

  delete(id: string) {
    return prisma.taskAttachment.delete({ where: { id } });
  }

  /**
   * Tim cac attachment thuoc cac Task da bi soft-delete qua retentionDays ngay.
   * Dung cho cleanup job.
   */
  findOrphanedAttachments(retentionDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    return prisma.taskAttachment.findMany({
      where: {
        task: {
          deletedAt: {
            not: null,
            lte: cutoff, // Da soft-delete truoc cutoff
          },
        },
      },
      select: {
        id: true,
        filePath: true,
        fileName: true,
        taskId: true,
      },
    });
  }

  /**
   * Xoa nhieu attachment theo danh sach id (sau khi da xoa file tren Storage).
   */
  deleteManyByIds(ids: string[]) {
    return prisma.taskAttachment.deleteMany({
      where: { id: { in: ids } },
    });
  }
}
