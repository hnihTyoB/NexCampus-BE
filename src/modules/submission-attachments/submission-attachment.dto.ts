export interface SubmissionAttachmentDto {
  id: string;
  submissionId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: Date;
}
