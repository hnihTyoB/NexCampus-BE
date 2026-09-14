import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  findAllAssignmentSchema,
  createAssignmentSchema,
  assignTaskSchema,
  updateAssignmentSchema,
  rejectAssignmentSchema,
  assignmentIdParamSchema,
  assignTaskIdParamSchema,
} from "./task-assignment.validation";
import { z } from "zod";

export function registerTaskAssignmentOpenApi(): void {
  openapiRegistry.register("CreateTaskAssignmentRequest", createAssignmentSchema);
  openapiRegistry.register("AssignTaskRequest", assignTaskSchema);
  openapiRegistry.register("UpdateTaskAssignmentRequest", updateAssignmentSchema);
  openapiRegistry.register("RejectAssignmentRequest", rejectAssignmentSchema);

  // GET /task-assignments
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-assignments",
    tags: ["Task Assignments"],
    summary: "Lấy danh sách phân công công việc",
    security: [{ BearerAuth: [] }],
    request: { query: findAllAssignmentSchema },
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

  // GET /task-assignments/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-assignments/{id}",
    tags: ["Task Assignments"],
    summary: "Lấy chi tiết phân công công việc",
    security: [{ BearerAuth: [] }],
    request: { params: assignmentIdParamSchema },
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
      404: { description: "Không tìm thấy phân công" },
    },
  });

  // POST /task-assignments
  openapiRegistry.registerPath({
    method: "post",
    path: "/task-assignments",
    tags: ["Task Assignments"],
    summary: "Tạo phân công công việc (nội bộ hoặc xuyên team)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createAssignmentSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Phân công thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      409: { description: "Task đã được phân công hoặc vượt quá capacity" },
    },
  });

  // PUT /task-assignments/task/:taskId
  openapiRegistry.registerPath({
    method: "put",
    path: "/task-assignments/task/{taskId}",
    tags: ["Task Assignments"],
    summary: "Giao việc hoặc cập nhật người làm theo taskId",
    security: [{ BearerAuth: [] }],
    request: {
      params: assignTaskIdParamSchema,
      body: {
        content: {
          "application/json": { schema: assignTaskSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Phân công thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      409: { description: "Công việc đã hoàn thành (TASK_ALREADY_COMPLETED) hoặc vượt capacity" },
    },
  });

  // DELETE /task-assignments/task/:taskId
  openapiRegistry.registerPath({
    method: "delete",
    path: "/task-assignments/task/{taskId}",
    tags: ["Task Assignments"],
    summary: "Hủy giao việc theo taskId",
    security: [{ BearerAuth: [] }],
    request: { params: assignTaskIdParamSchema },
    responses: {
      200: {
        description: "Hủy giao việc thành công",
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

  // PUT /task-assignments/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/task-assignments/{id}",
    tags: ["Task Assignments"],
    summary: "Cập nhật phân công (Khóa khi DONE với 409 TASK_ALREADY_COMPLETED)",
    security: [{ BearerAuth: [] }],
    request: {
      params: assignmentIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateAssignmentSchema },
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
      409: { description: "Công việc đã hoàn thành (TASK_ALREADY_COMPLETED) hoặc vượt capacity" },
    },
  });

  // PATCH /task-assignments/:id/approve
  openapiRegistry.registerPath({
    method: "patch",
    path: "/task-assignments/{id}/approve",
    tags: ["Task Assignments"],
    summary: "Leader trực tiếp duyệt yêu cầu giao việc xuyên team (chuyển sang TODO)",
    security: [{ BearerAuth: [] }],
    request: { params: assignmentIdParamSchema },
    responses: {
      200: {
        description: "Phê duyệt thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      403: { description: "Không có quyền duyệt" },
      409: { description: "Vượt quá capacity của TTS" },
    },
  });

  // PATCH /task-assignments/:id/reject
  openapiRegistry.registerPath({
    method: "patch",
    path: "/task-assignments/{id}/reject",
    tags: ["Task Assignments"],
    summary: "Leader trực tiếp từ chối yêu cầu giao việc xuyên team (chuyển sang BLOCKED)",
    security: [{ BearerAuth: [] }],
    request: {
      params: assignmentIdParamSchema,
      body: {
        content: {
          "application/json": { schema: rejectAssignmentSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Từ chối thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      403: { description: "Không có quyền từ chối" },
    },
  });

  // DELETE /task-assignments/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/task-assignments/{id}",
    tags: ["Task Assignments"],
    summary: "Hủy phân công công việc (Khóa khi DONE với 409 TASK_ALREADY_COMPLETED)",
    security: [{ BearerAuth: [] }],
    request: { params: assignmentIdParamSchema },
    responses: {
      200: {
        description: "Hủy phân công thành công",
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
