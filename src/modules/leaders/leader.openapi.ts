import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  findAllLeaderSchema,
  createLeaderSchema,
  updateLeaderSchema,
  updateMeLeaderSchema,
  leaderIdParamSchema,
} from "./leader.validation";
import { z } from "zod";

export function registerLeaderOpenApi(): void {
  openapiRegistry.register("CreateLeaderRequest", createLeaderSchema);
  openapiRegistry.register("UpdateLeaderRequest", updateLeaderSchema);
  openapiRegistry.register("UpdateMeLeaderRequest", updateMeLeaderSchema);

  // GET /leaders/me
  openapiRegistry.registerPath({
    method: "get",
    path: "/leaders/me",
    tags: ["Leaders"],
    summary: "Lấy thông tin hồ sơ của Leader đang đăng nhập",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Thành công" },
      404: { description: "Không tìm thấy hồ sơ Leader" },
    },
  });

  // PUT /leaders/me
  openapiRegistry.registerPath({
    method: "put",
    path: "/leaders/me",
    tags: ["Leaders"],
    summary: "Cập nhật thông tin cá nhân của Leader đang đăng nhập",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: updateMeLeaderSchema },
        },
      },
    },
    responses: {
      200: { description: "Cập nhật thành công" },
    },
  });

  // GET /leaders
  openapiRegistry.registerPath({
    method: "get",
    path: "/leaders",
    tags: ["Leaders"],
    summary: "Lấy danh sách Leader (Phân trang, tìm kiếm & lọc phòng ban)",
    security: [{ BearerAuth: [] }],
    request: { query: findAllLeaderSchema },
    responses: {
      200: { description: "Thành công" },
    },
  });

  // GET /leaders/:id
  openapiRegistry.registerPath({
    method: "get",
    path: "/leaders/{id}",
    tags: ["Leaders"],
    summary: "Lấy thông tin chi tiết Leader kèm danh sách phòng ban và TTS trực thuộc",
    security: [{ BearerAuth: [] }],
    request: { params: leaderIdParamSchema },
    responses: {
      200: { description: "Thành công" },
      404: { description: "Không tìm thấy Leader" },
    },
  });

  // POST /leaders
  openapiRegistry.registerPath({
    method: "post",
    path: "/leaders",
    tags: ["Leaders"],
    summary: "Tạo hồ sơ Leader (Gán tối đa 3 phòng ban)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createLeaderSchema },
        },
      },
    },
    responses: {
      201: { description: "Tạo Leader thành công" },
      409: { description: "Người dùng đã có hồ sơ Leader" },
    },
  });

  // PUT /leaders/:id
  openapiRegistry.registerPath({
    method: "put",
    path: "/leaders/{id}",
    tags: ["Leaders"],
    summary: "Cập nhật thông tin Leader (Đồng bộ phòng ban và reset chức danh nếu thay đổi)",
    security: [{ BearerAuth: [] }],
    request: {
      params: leaderIdParamSchema,
      body: {
        content: {
          "application/json": { schema: updateLeaderSchema },
        },
      },
    },
    responses: {
      200: { description: "Cập nhật thành công" },
      404: { description: "Không tìm thấy Leader" },
    },
  });

  // DELETE /leaders/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/leaders/{id}",
    tags: ["Leaders"],
    summary: "Xóa hồ sơ Leader",
    security: [{ BearerAuth: [] }],
    request: { params: leaderIdParamSchema },
    responses: {
      200: { description: "Xóa thành công" },
      404: { description: "Không tìm thấy Leader" },
    },
  });
}
