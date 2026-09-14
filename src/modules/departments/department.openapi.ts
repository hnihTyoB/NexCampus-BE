import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  findAllDepartmentSchema,
  departmentIdParamSchema,
  createPositionSchema,
  updatePositionSchema,
  positionIdParamSchema,
} from "./department.validation";
import { z } from "zod";

export function registerDepartmentOpenApi(): void {
  openapiRegistry.register("CreateDepartmentRequest", createDepartmentSchema);
  openapiRegistry.register("UpdateDepartmentRequest", updateDepartmentSchema);
  openapiRegistry.register("CreatePositionRequest", createPositionSchema);
  openapiRegistry.register("UpdatePositionRequest", updatePositionSchema);

  // GET /departments
  openapiRegistry.registerPath({
    method: "get",
    path: "/departments",
    tags: ["Departments"],
    summary: "Lấy danh sách phòng ban",
    security: [{ BearerAuth: [] }],
    request: { query: findAllDepartmentSchema },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  positionsCount: z.number().optional(),
                  internsCount: z.number().optional(),
                  positions: z.array(
                    z.object({
                      id: z.string().uuid(),
                      name: z.string(),
                    }),
                  ),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // GET /departments/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/departments/{id}",
    tags: ["Departments"],
    summary: "Lấy chi tiết phòng ban",
    request: { params: departmentIdParamSchema },
    responses: {
      200: { description: "Thành công" },
      404: { description: "Không tìm thấy phòng ban" },
    },
  });

  // POST /departments
  openapiRegistry.registerPath({
    method: "post",
    path: "/departments",
    tags: ["Departments"],
    summary: "Tạo phòng ban mới",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createDepartmentSchema },
        },
      },
    },
    responses: {
      201: { description: "Tạo thành công" },
      409: { description: "Tên phòng ban đã tồn tại" },
    },
  });

  // PUT /departments/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/departments/{id}",
    tags: ["Departments"],
    summary: "Cập nhật thông tin phòng ban",
    security: [{ BearerAuth: [] }],
    request: {
      params: departmentIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateDepartmentSchema },
        },
      },
    },
    responses: {
      200: { description: "Cập nhật thành công" },
      404: { description: "Không tìm thấy phòng ban" },
    },
  });

  // DELETE /departments/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/departments/{id}",
    tags: ["Departments"],
    summary: "Xóa phòng ban (Soft-delete)",
    security: [{ BearerAuth: [] }],
    request: { params: departmentIdParamSchema },
    responses: {
      200: { description: "Xóa thành công" },
      400: { description: "Không thể xóa do có liên kết phụ thuộc" },
      404: { description: "Không tìm thấy phòng ban" },
    },
  });

  // GET /departments/:id/positions
  openapiRegistry.registerPath({
    method: "get",
    path: "/departments/{id}/positions",
    tags: ["Positions"],
    summary: "Lấy danh sách vị trí theo phòng ban",
    request: { params: departmentIdParamSchema },
    responses: {
      200: { description: "Thành công" },
    },
  });

  // POST /departments/positions
  openapiRegistry.registerPath({
    method: "post",
    path: "/departments/positions",
    tags: ["Positions"],
    summary: "Tạo vị trí mới trong phòng ban",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createPositionSchema },
        },
      },
    },
    responses: {
      201: { description: "Tạo vị trí thành công" },
    },
  });

  // PUT /departments/positions/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/departments/positions/{id}",
    tags: ["Positions"],
    summary: "Cập nhật vị trí",
    security: [{ BearerAuth: [] }],
    request: {
      params: positionIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updatePositionSchema },
        },
      },
    },
    responses: {
      200: { description: "Cập nhật vị trí thành công" },
      404: { description: "Không tìm thấy vị trí" },
    },
  });

  // DELETE /departments/positions/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/departments/positions/{id}",
    tags: ["Positions"],
    summary: "Xóa vị trí",
    security: [{ BearerAuth: [] }],
    request: { params: positionIdParamSchema },
    responses: {
      200: { description: "Xóa vị trí thành công" },
      400: { description: "Không thể xóa do có liên kết phụ thuộc" },
      404: { description: "Không tìm thấy vị trí" },
    },
  });
}
