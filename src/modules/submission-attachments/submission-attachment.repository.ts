import { prisma } from "../../database/prisma.client";

export class SubmissionAttachmentRepository {
  findBySubmissionId(submissionId: string) {
    return prisma.submissionAttachment.findMany({
      where: { submissionId },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string) {
    return prisma.submissionAttachment.findUnique({ where: { id } });
  }

  create(data: {
    submissionId: string;
    fileName: string;
    fileUrl: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedBy: string;
  }) {
    return prisma.submissionAttachment.create({ data });
  }

  delete(id: string) {
    return prisma.submissionAttachment.delete({ where: { id } });
  }

  deleteManyBySubmissionId(submissionId: string) {
    return prisma.submissionAttachment.deleteMany({
      where: { submissionId },
    });
  }

  /**
   * Tìm các tệp đính kèm bài nộp của học viên đã bị xóa mềm qua retentionDays ngày.
   */
  findOrphanedAttachments(retentionDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    return prisma.submissionAttachment.findMany({
      where: {
        submission: {
          assignment: {
            intern: {
              deletedAt: {
                not: null,
                lte: cutoff,
              },
            },
          },
        },
      },
      select: {
        id: true,
        filePath: true,
        fileName: true,
      },
    });
  }

  deleteManyByIds(ids: string[]) {
    return prisma.submissionAttachment.deleteMany({
      where: { id: { in: ids } },
    });
  }
}
