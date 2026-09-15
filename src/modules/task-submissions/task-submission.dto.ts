import { ReviewStatus } from "@prisma/client";

export interface SubmissionAttachmentDto {
  id: string;
  submissionId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: Date | string;
}

export interface TaskSubmissionDto {
  id: string;
  assignmentId: string;
  attempt: number;
  prLink: string | null;
  videoDemo: string | null;
  note: string | null;
  reviewStatus: ReviewStatus;
  reviewComment: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  submittedAt: Date | string;
  updatedAt: Date | string;
  assignment?: {
    id: string;
    taskId: string;
    internId: string | null;
    status: string;
    task?: {
      id: string;
      code: string | null;
      title: string;
    };
    intern?: {
      id: string;
      fullName: string;
      user?: {
        email: string | null;
      };
    } | null;
  };
  reviewer?: {
    id: string;
    email: string | null;
    fullName: string | null;
  } | null;
  attachments?: SubmissionAttachmentDto[];
}

export interface CreateAttachmentInput {
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}

export interface CreateTaskSubmissionDto {
  assignmentId: string;
  prLink?: string;
  videoDemo?: string;
  note?: string;
  attachments?: CreateAttachmentInput[];
}

export interface ReviewSubmissionDto {
  reviewStatus: ReviewStatus;
  reviewComment?: string;
}

export interface TaskSubmissionQueryDto {
  assignmentId?: string;
  internId?: string;
  reviewStatus?: ReviewStatus;
  page?: number;
  limit?: number;
  sortBy?: "submittedAt" | "attempt";
  order?: "asc" | "desc";
}
