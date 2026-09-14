import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  findAllInternSchema,
  lookupAssignmentInternSchema,
  createInternSchema,
  directCreateInternSchema,
  updateInternSchema,
  assignLeaderSchema,
  updateMeInternSchema,
  internIdParamSchema,
} from "./intern.validation";
import { z } from "zod";

export function registerInternOpenApi(): void {
  openapiRegistry.register("CreateInternRequest", createInternSchema);
  openapiRegistry.register("DirectCreateInternRequest", directCreateInternSchema);
  openapiRegistry.register("UpdateInternRequest", updateInternSchema);
  openapiRegistry.register("AssignLeaderRequest", assignLeaderSchema);
  openapiRegistry.register("UpdateMeInternRequest", updateMeInternSchema);

  // GET /interns/me
  openapiRegistry.registerPath({
    method: "get",
    path: "/interns/me",
    tags: ["Interns"],
    summary: "Lấy thông tin hồ sơ của TTS đang đăng nhập",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Thành công" },
      404: { description: "Không tìm thấy hồ sơ thực tập sinh" },
    },
  });

  // PUT /interns/me
  openapiRegistry.registerPath({
    method: "put",
    path: "/interns/me",
    tags: ["Interns"],
    summary: "Cập nhật thông tin cá nhân của TTS đang đăng nhập",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: updateMeInternSchema },
        },
      },
    },
    responses: {
      200: { description: "Cập nhật thành công" },
    },
  });

  // GET /interns/assignment-lookup
  openapiRegistry.registerPath({
    method: "get",
    path: "/interns/assignment-lookup",
    tags: ["Interns"],
    summary: "Tra cứu thông tin TTS thuộc team khác phục vụ giao việc xuyên team",
    security: [{ BearerAuth: [] }],
    request: { query: lookupAssignmentInternSchema },
    responses: {
      200: { description: "Thành công" },
      404: { description: "Không tìm thấy TTS active thuộc team khác" },
    },
  });

  // POST /interns/direct
  openapiRegistry.registerPath({
    method: "post",
    path: "/interns/direct",
    tags: ["Interns"],
    summary: "Admin tạo trực tiếp tài khoản và hồ sơ TTS",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: directCreateInternSchema },
        },
      },
    },
    responses: {
      201: { description: "Tạo tài khoản và hồ sơ thành công" },
      409: { description: "Email đã tồn tại" },
    },
  });

  // GET /interns
  openapiRegistry.registerPath({
    method: "get",
    path: "/interns",
    tags: ["Interns"],
    summary: "Danh sách thực tập sinh (Phân trang, tìm kiếm đa tiêu chí & lọc theo phòng ban, leader, trạng thái)",
    security: [{ BearerAuth: [] }],
    request: { query: findAllInternSchema },
    responses: {
      200: { description: "Thành công" },
    },
  });

  // GET /interns/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/interns/{id}",
    tags: ["Interns"],
    summary: "Lấy chi tiết thực tập sinh (Đầy đủ thông tin học vụ, thời gian, phòng ban, leader)",
    security: [{ BearerAuth: [] }],
    request: { params: internIdParamSchema },
    responses: {
      200: { description: "Thành công" },
      404: { description: "Không tìm thấy thực tập sinh" },
    },
  });

  // POST /interns
  openapiRegistry.registerPath({
    method: "post",
    path: "/interns",
    tags: ["Interns"],
    summary: "Tạo hồ sơ thực tập sinh cho user đã tồn tại",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createInternSchema },
        },
      },
    },
    responses: {
      201: { description: "Tạo thành công" },
      409: { description: "Người dùng đã có hồ sơ thực tập sinh" },
    },
  });

  // PUT /interns/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/interns/{id}",
    tags: ["Interns"],
    summary: "Cập nhật thông tin thực tập sinh",
    security: [{ BearerAuth: [] }],
    request: {
      params: internIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateInternSchema },
        },
      },
    },
    responses: {
      200: { description: "Cập nhật thành công" },
      404: { description: "Không tìm thấy thực tập sinh" },
    },
  });

  // PATCH /interns/:id/assign-leader
  openapiRegistry.registerPath({
    method: "patch",
    path: "/interns/{id}/assign-leader",
    tags: ["Interns"],
    summary: "Phân công hoặc chuyển đổi Leader trực tiếp cho TTS",
    security: [{ BearerAuth: [] }],
    request: {
      params: internIdParamSchema,
      body: {
        content: {
          "application/json": { schema: assignLeaderSchema },
        },
      },
    },
    responses: {
      200: { description: "Phân công thành công" },
      404: { description: "Không tìm thấy Leader hoặc TTS" },
    },
  });

  // DELETE /interns/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/interns/{id}",
    tags: ["Interns"],
    summary: "Xóa thực tập sinh (Soft-delete)",
    security: [{ BearerAuth: [] }],
    request: { params: internIdParamSchema },
    responses: {
      200: { description: "Xóa thành công" },
      404: { description: "Không tìm thấy thực tập sinh" },
    },
  });
}
