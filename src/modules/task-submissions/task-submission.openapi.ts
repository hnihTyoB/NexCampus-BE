import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  submissionIdParamSchema,
  attachmentIdParamSchema,
  findAllSubmissionSchema,
  createSubmissionSchema,
  reviewSubmissionSchema,
  getSubmissionUploadUrlSchema,
  addAttachmentSchema,
} from "./task-submission.validation";
import { z } from "zod";

export function registerTaskSubmissionOpenApi(): void {
  openapiRegistry.register("CreateTaskSubmissionRequest", createSubmissionSchema);
  openapiRegistry.register("ReviewSubmissionRequest", reviewSubmissionSchema);
  openapiRegistry.register("AddSubmissionAttachmentRequest", addAttachmentSchema);

  // GET /task-submissions/upload-url
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-submissions/upload-url",
    tags: ["Submissions"],
    summary: "Lấy URL presigned upload file nộp bài lên Cloudflare R2",
    security: [{ BearerAuth: [] }],
    request: { query: getSubmissionUploadUrlSchema },
    responses: {
      200: {
        description: "Sinh upload URL thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                uploadUrl: z.string(),
                fileUrl: z.string(),
                filePath: z.string(),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /task-submissions
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-submissions",
    tags: ["Submissions"],
    summary: "Lấy danh sách bài nộp công việc",
    security: [{ BearerAuth: [] }],
    request: { query: findAllSubmissionSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(z.record(z.unknown())),
              meta: z.object({
                total: z.number(),
                page: z.number(),
                limit: z.number(),
                totalPages: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /task-submissions/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-submissions/{id}",
    tags: ["Submissions"],
    summary: "Xem chi tiết bài nộp công việc",
    security: [{ BearerAuth: [] }],
    request: { params: submissionIdParamSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy bài nộp" },
    },
  });

  // POST /task-submissions
  openapiRegistry.registerPath({
    method: "post",
    path: "/task-submissions",
    tags: ["Submissions"],
    summary: "TTS nộp bài làm (Bắt buộc task đang IN_PROGRESS; tự tính attempt)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createSubmissionSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Nộp bài thành công (chuyển sang REVIEW)",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      400: { description: "Task chưa ở trạng thái IN_PROGRESS (TASK_NOT_IN_PROGRESS)" },
      409: { description: "Task đã hoàn thành (TASK_ALREADY_COMPLETED)" },
    },
  });

  // POST /task-submissions/:id/review
  openapiRegistry.registerPath({
    method: "post",
    path: "/task-submissions/{id}/review",
    tags: ["Submissions"],
    summary: "Leader/Admin đánh giá bài nộp (APPROVED -> DONE, REJECTED -> TODO)",
    security: [{ BearerAuth: [] }],
    request: {
      params: submissionIdParamSchema,
      body: {
        content: {
          "application/json": { schema: reviewSubmissionSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Đánh giá bài nộp thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      400: { description: "Thiếu nhận xét khi REJECTED hoặc bài nộp đã được review" },
      403: { description: "Chỉ Leader quản lý hoặc Admin mới có quyền" },
    },
  });

  // POST /task-submissions/:id/attachments
  openapiRegistry.registerPath({
    method: "post",
    path: "/task-submissions/{id}/attachments",
    tags: ["Submissions"],
    summary: "Thêm tệp đính kèm vào bài nộp",
    security: [{ BearerAuth: [] }],
    request: {
      params: submissionIdParamSchema,
      body: {
        content: {
          "application/json": { schema: addAttachmentSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Thêm tệp đính kèm thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
    },
  });

  // DELETE /task-submissions/:id/attachments/:attachmentId
  openapiRegistry.registerPath({
    method: "delete",
    path: "/task-submissions/{id}/attachments/{attachmentId}",
    tags: ["Submissions"],
    summary: "Xóa tệp đính kèm khỏi bài nộp",
    security: [{ BearerAuth: [] }],
    request: { params: attachmentIdParamSchema },
    responses: {
      200: {
        description: "Xóa tệp đính kèm thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
            }),
          },
        },
      },
    },
  });
}
