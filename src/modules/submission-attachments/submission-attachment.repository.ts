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
}
