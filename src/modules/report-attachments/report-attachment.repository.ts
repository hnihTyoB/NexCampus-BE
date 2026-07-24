import { prisma } from "../../database/prisma.client";

export class ReportAttachmentRepository {
  findByReportId(reportId: string) {
    return prisma.reportAttachment.findMany({
      where: { reportId },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string) {
    return prisma.reportAttachment.findUnique({ where: { id } });
  }

  create(data: {
    reportId: string;
    fileName: string;
    fileUrl: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedBy: string;
  }) {
    return prisma.reportAttachment.create({ data });
  }

  delete(id: string) {
    return prisma.reportAttachment.delete({ where: { id } });
  }

  deleteManyByReportId(reportId: string) {
    return prisma.reportAttachment.deleteMany({
      where: { reportId },
    });
  }

  /**
   * Tìm các tệp đính kèm báo cáo cũ hơn retentionDays ngày (kể cả không bị xóa mềm).
   */
  findOldAttachments(retentionDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    return prisma.reportAttachment.findMany({
      where: {
        createdAt: {
          lte: cutoff,
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
    return prisma.reportAttachment.deleteMany({
      where: { id: { in: ids } },
    });
  }
}
