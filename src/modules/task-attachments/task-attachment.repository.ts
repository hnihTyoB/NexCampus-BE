import { prisma } from "../../database/prisma.client";

export class TaskAttachmentRepository {
  findByTaskId(taskId: string) {
    return prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
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

  createLink(data: {
    taskId: string;
    fileName: string;
    fileUrl: string;
    uploadedBy: string;
  }) {
    return prisma.taskAttachment.create({
      data: {
        taskId: data.taskId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        filePath: data.fileUrl,
        mimeType: "application/octet-stream",
        fileSize: 0,
        uploadedBy: data.uploadedBy,
      },
    });
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

  deleteManyByIds(ids: string[]) {
    return prisma.taskAttachment.deleteMany({
      where: { id: { in: ids } },
    });
  }
}
