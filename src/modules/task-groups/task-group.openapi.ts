import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  createTaskGroupSchema,
  updateTaskGroupSchema,
  queryTaskGroupSchema,
  taskGroupIdParamSchema,
} from "./task-group.validation";
import { z } from "zod";

export function registerTaskGroupOpenApi(): void {
  openapiRegistry.register("CreateTaskGroupRequest", createTaskGroupSchema);
  openapiRegistry.register("UpdateTaskGroupRequest", updateTaskGroupSchema);

  // GET /task-groups
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-groups",
    tags: ["Task Groups"],
    summary: "Lấy danh sách nhóm công việc (phân quyền theo phòng ban/nhóm)",
    security: [{ BearerAuth: [] }],
    request: { query: queryTaskGroupSchema },
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

  // GET /task-groups/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-groups/{id}",
    tags: ["Task Groups"],
    summary: "Lấy chi tiết nhóm công việc kèm danh sách thành viên",
    security: [{ BearerAuth: [] }],
    request: { params: taskGroupIdParamSchema },
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
      404: { description: "Không tìm thấy nhóm công việc" },
    },
  });

  // GET /task-groups/:id/progress
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-groups/{id}/progress",
    tags: ["Task Groups"],
    summary: "Thống kê tiến độ nhóm công việc",
    security: [{ BearerAuth: [] }],
    request: { params: taskGroupIdParamSchema },
    responses: {
      200: {
        description: "Thống kê tiến độ thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                taskGroupId: z.string().uuid(),
                taskGroupName: z.string(),
                totalTasks: z.number(),
                completedTasks: z.number(),
                inProgressTasks: z.number(),
                reviewTasks: z.number(),
                todoTasks: z.number(),
                blockedTasks: z.number(),
                unassignedTasks: z.number(),
                completionRate: z.number(),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /task-groups/:id/tasks
  openapiRegistry.registerPath({
    method: "get",
    path: "/task-groups/{id}/tasks",
    tags: ["Task Groups"],
    summary: "Lấy danh sách công việc thuộc nhóm",
    security: [{ BearerAuth: [] }],
    request: { params: taskGroupIdParamSchema },
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

  // POST /task-groups
  openapiRegistry.registerPath({
    method: "post",
    path: "/task-groups",
    tags: ["Task Groups"],
    summary: "Tạo nhóm công việc mới",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createTaskGroupSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo nhóm thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      409: { description: "Tên nhóm đã tồn tại trong phòng ban" },
    },
  });

  // PUT /task-groups/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/task-groups/{id}",
    tags: ["Task Groups"],
    summary: "Cập nhật nhóm công việc",
    security: [{ BearerAuth: [] }],
    request: {
      params: taskGroupIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateTaskGroupSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật nhóm thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.record(z.unknown()),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy nhóm công việc" },
    },
  });

  // DELETE /task-groups/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/task-groups/{id}",
    tags: ["Task Groups"],
    summary: "Xóa nhóm công việc",
    security: [{ BearerAuth: [] }],
    request: { params: taskGroupIdParamSchema },
    responses: {
      200: {
        description: "Xóa nhóm thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
            }),
          },
        },
      },
      404: { description: "Không tìm thấy nhóm công việc" },
    },
  });
}
