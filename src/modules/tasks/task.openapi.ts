import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  findAllTaskSchema,
  taskAnalyticsQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
  taskAttachmentParamsSchema,
  getAttachmentUploadUrlSchema,
  confirmAttachmentUploadSchema,
  createLinkAttachmentSchema,
} from "./task.validation";
import { z } from "zod";

export function registerTaskOpenApi(): void {
  openapiRegistry.register("CreateTaskRequest", createTaskSchema);
  openapiRegistry.register("UpdateTaskRequest", updateTaskSchema);
  openapiRegistry.register("ConfirmAttachmentUploadRequest", confirmAttachmentUploadSchema);
  openapiRegistry.register("CreateLinkAttachmentRequest", createLinkAttachmentSchema);

  // GET /tasks
  openapiRegistry.registerPath({
    method: "get",
    path: "/tasks",
    tags: ["Tasks"],
    summary: "Lấy danh sách công việc (phân quyền theo vai trò)",
    security: [{ BearerAuth: [] }],
    request: { query: findAllTaskSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                data: z.array(z.record(z.unknown())),
                meta: z.object({
                  total: z.number(),
                  page: z.number(),
                  limit: z.number(),
                  totalPages: z.number(),
                }),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /tasks/analytics
  openapiRegistry.registerPath({
    method: "get",
    path: "/tasks/analytics",
    tags: ["Tasks"],
    summary: "Lấy thống kê công việc và khối lượng làm việc (Analytics)",
    security: [{ BearerAuth: [] }],
    request: { query: taskAnalyticsQuerySchema },
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
    },
  });

  // GET /tasks/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/tasks/{id}",
    tags: ["Tasks"],
    summary: "Lấy chi tiết công việc",
    security: [{ BearerAuth: [] }],
    request: { params: taskIdParamSchema },
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
      404: { description: "Không tìm thấy công việc" },
    },
  });

  // POST /tasks
  openapiRegistry.registerPath({
    method: "post",
    path: "/tasks",
    tags: ["Tasks"],
    summary: "Tạo công việc mới",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createTaskSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo công việc thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      409: { description: "Mã công việc đã tồn tại trong nhóm" },
    },
  });

  // PUT /tasks/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/tasks/{id}",
    tags: ["Tasks"],
    summary: "Cập nhật công việc (Khóa khi task DONE với 409 TASK_ALREADY_COMPLETED)",
    security: [{ BearerAuth: [] }],
    request: {
      params: taskIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateTaskSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy công việc" },
      409: { description: "Công việc đã hoàn thành hoặc mã bị trùng (TASK_ALREADY_COMPLETED)" },
    },
  });

  // DELETE /tasks/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/tasks/{id}",
    tags: ["Tasks"],
    summary: "Xóa công việc (Khóa khi task DONE với 409 TASK_ALREADY_COMPLETED)",
    security: [{ BearerAuth: [] }],
    request: { params: taskIdParamSchema },
    responses: {
      200: {
        description: "Xóa thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy công việc" },
      409: { description: "Công việc đã hoàn thành (TASK_ALREADY_COMPLETED)" },
    },
  });

  // ─── Attachments ────────────────────────────────────────────────────────────

  // GET /tasks/:taskId/attachments
  openapiRegistry.registerPath({
    method: "get",
    path: "/tasks/{taskId}/attachments",
    tags: ["Tasks"],
    summary: "Lấy danh sách tệp đính kèm của công việc",
    security: [{ BearerAuth: [] }],
    request: { params: taskAttachmentParamsSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(z.record(z.unknown())),
            }),
          },
        },
      },
    },
  });

  // GET /tasks/:taskId/attachments/upload-url
  openapiRegistry.registerPath({
    method: "get",
    path: "/tasks/{taskId}/attachments/upload-url",
    tags: ["Tasks"],
    summary: "Lấy Cloudflare R2 presigned PUT URL để tải tệp đính kèm (prefix tasks/)",
    security: [{ BearerAuth: [] }],
    request: {
      params: taskAttachmentParamsSchema,
      query: getAttachmentUploadUrlSchema,
    },
    responses: {
      200: {
        description: "Sinh URL upload thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                uploadUrl: z.string().url(),
                key: z.string(),
                publicUrl: z.string().url(),
              }),
            }),
          },
        },
      },
      409: { description: "Công việc đã hoàn thành (TASK_ALREADY_COMPLETED)" },
    },
  });

  // POST /tasks/:taskId/attachments/confirm
  openapiRegistry.registerPath({
    method: "post",
    path: "/tasks/{taskId}/attachments/confirm",
    tags: ["Tasks"],
    summary: "Xác nhận và lưu metadata tệp đính kèm sau khi upload R2",
    security: [{ BearerAuth: [] }],
    request: {
      params: taskAttachmentParamsSchema,
      body: {
        content: {
          "application/json": { schema: confirmAttachmentUploadSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Lưu tệp đính kèm thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      409: { description: "Công việc đã hoàn thành (TASK_ALREADY_COMPLETED)" },
    },
  });

  // POST /tasks/:taskId/attachments/link
  openapiRegistry.registerPath({
    method: "post",
    path: "/tasks/{taskId}/attachments/link",
    tags: ["Tasks"],
    summary: "Thêm liên kết tệp ngoài vào công việc",
    security: [{ BearerAuth: [] }],
    request: {
      params: taskAttachmentParamsSchema,
      body: {
        content: {
          "application/json": { schema: createLinkAttachmentSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Thêm liên kết thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      409: { description: "Công việc đã hoàn thành (TASK_ALREADY_COMPLETED)" },
    },
  });

  // DELETE /tasks/:taskId/attachments/:attachmentId
  openapiRegistry.registerPath({
    method: "delete",
    path: "/tasks/{taskId}/attachments/{attachmentId}",
    tags: ["Tasks"],
    summary: "Xóa tệp đính kèm khỏi công việc và Cloudflare R2",
    security: [{ BearerAuth: [] }],
    request: { params: taskAttachmentParamsSchema },
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
      409: { description: "Công việc đã hoàn thành (TASK_ALREADY_COMPLETED)" },
    },
  });
}
