export interface ReportAttachmentDto {
  id: string;
  reportId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: Date;
}
