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
}
