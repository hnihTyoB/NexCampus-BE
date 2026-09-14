import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  createInviteSchema,
  getApplicationInvitesSchema,
  createApplicationSchema,
  findAllApplicationSchema,
  applicationIdParamSchema,
  inviteIdParamSchema,
  assignApplicationSchema,
  approveApplicationSchema,
  rejectApplicationSchema,
  reviewApplicationSchema,
  getAttachmentUploadUrlSchema,
} from "./application.validation";

export function registerApplicationOpenApi(): void {
  openapiRegistry.register("CreateInviteRequest", createInviteSchema);
  openapiRegistry.register("CreateApplicationRequest", createApplicationSchema);
  openapiRegistry.register("AssignApplicationRequest", assignApplicationSchema);
  openapiRegistry.register("ApproveApplicationRequest", approveApplicationSchema);
  openapiRegistry.register("RejectApplicationRequest", rejectApplicationSchema);
  openapiRegistry.register("ReviewApplicationRequest", reviewApplicationSchema);

  // ─── Invites ──────────────────────────────────────────────────────────────

  openapiRegistry.registerPath({
    method: "post",
    path: "/applications/invites",
    tags: ["Applications"],
    summary: "Tạo thư mời ứng tuyển mới (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: createInviteSchema },
        },
      },
    },
    responses: {
      201: { description: "Tạo thư mời thành công" },
      400: { description: "Thư mời đang hoạt động đã tồn tại cho email này" },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/applications/invites",
    tags: ["Applications"],
    summary: "Lấy danh sách thư mời ứng tuyển (Admin)",
    security: [{ BearerAuth: [] }],
    request: { query: getApplicationInvitesSchema },
    responses: {
      200: { description: "Thành công" },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/applications/invites/verify/{token}",
    tags: ["Applications"],
    summary: "Xác thực token thư mời ứng tuyển (Public)",
    request: {
      params: applicationIdParamSchema,
    },
    responses: {
      200: { description: "Token hợp lệ" },
      400: { description: "Token không hợp lệ, đã dùng hoặc đã hết hạn" },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/applications/invites/{id}",
    tags: ["Applications"],
    summary: "Xem chi tiết thư mời ứng tuyển (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: inviteIdParamSchema,
    },
    responses: {
      200: { description: "Thành công" },
      404: { description: "Không tìm thấy thư mời" },
    },
  });

  openapiRegistry.registerPath({
    method: "patch",
    path: "/applications/invites/{id}/revoke",
    tags: ["Applications"],
    summary: "Thu hồi thư mời ứng tuyển (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: inviteIdParamSchema,
    },
    responses: {
      200: { description: "Thu hồi thành công" },
      400: { description: "Không thể thu hồi thư mời đã sử dụng" },
    },
  });

  // ─── Candidate Submission & Uploads ───────────────────────────────────────

  openapiRegistry.registerPath({
    method: "get",
    path: "/applications/attachments/upload-url",
    tags: ["Applications"],
    summary: "Lấy presigned URL tải lên tệp đính kèm Cloudflare R2 (Public)",
    request: { query: getAttachmentUploadUrlSchema },
    responses: {
      200: { description: "Thành công" },
    },
  });

  openapiRegistry.registerPath({
    method: "post",
    path: "/applications/submit",
    tags: ["Applications"],
    summary: "Nộp hồ sơ ứng tuyển trực tuyến (Public Onboarding Form)",
    request: {
      body: {
        content: {
          "application/json": { schema: createApplicationSchema },
        },
      },
    },
    responses: {
      201: { description: "Nộp hồ sơ thành công" },
      400: { description: "Dữ liệu hoặc token không hợp lệ" },
      409: { description: "Email hoặc số điện thoại đã tồn tại trong hệ thống" },
    },
  });

  // ─── Applications Management ──────────────────────────────────────────────

  openapiRegistry.registerPath({
    method: "get",
    path: "/applications/stats",
    tags: ["Applications"],
    summary: "Thống kê tổng quan số lượng đơn và thư mời (Admin)",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Thành công" },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/applications",
    tags: ["Applications"],
    summary: "Danh sách đơn ứng tuyển (Phân trang, tìm kiếm & lọc)",
    security: [{ BearerAuth: [] }],
    request: { query: findAllApplicationSchema },
    responses: {
      200: { description: "Thành công" },
    },
  });

  openapiRegistry.registerPath({
    method: "get",
    path: "/applications/{id}",
    tags: ["Applications"],
    summary: "Xem chi tiết đơn ứng tuyển (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: applicationIdParamSchema,
    },
    responses: {
      200: { description: "Thành công" },
      404: { description: "Không tìm thấy đơn ứng tuyển" },
    },
  });

  openapiRegistry.registerPath({
    method: "patch",
    path: "/applications/{id}/assign",
    tags: ["Applications"],
    summary: "Gán phòng ban và vị trí nội bộ cho đơn ứng tuyển (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: applicationIdParamSchema,
      body: {
        content: {
          "application/json": { schema: assignApplicationSchema },
        },
      },
    },
    responses: {
      200: { description: "Gán thành công" },
      404: { description: "Phòng ban hoặc vị trí không tồn tại" },
      409: { description: "Chỉ đơn PENDING mới được phép gán" },
    },
  });

  openapiRegistry.registerPath({
    method: "post",
    path: "/applications/{id}/approve",
    tags: ["Applications"],
    summary: "Phê duyệt đơn ứng tuyển và tạo tài khoản TTS (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: applicationIdParamSchema,
      body: {
        content: {
          "application/json": { schema: approveApplicationSchema },
        },
      },
    },
    responses: {
      200: { description: "Phê duyệt thành công và đã tạo tài khoản thực tập sinh" },
      404: { description: "Không tìm thấy đơn ứng tuyển" },
      409: { description: "Chưa gán phòng ban/vị trí hoặc đơn không ở trạng thái PENDING" },
    },
  });

  openapiRegistry.registerPath({
    method: "post",
    path: "/applications/{id}/reject",
    tags: ["Applications"],
    summary: "Từ chối đơn ứng tuyển kèm lý do cụ thể (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: applicationIdParamSchema,
      body: {
        content: {
          "application/json": { schema: rejectApplicationSchema },
        },
      },
    },
    responses: {
      200: { description: "Từ chối đơn thành công" },
      404: { description: "Không tìm thấy đơn ứng tuyển" },
      409: { description: "Đơn không ở trạng thái PENDING" },
    },
  });

  openapiRegistry.registerPath({
    method: "delete",
    path: "/applications/{id}",
    tags: ["Applications"],
    summary: "Xóa (soft-delete) đơn ứng tuyển (Admin)",
    security: [{ BearerAuth: [] }],
    request: {
      params: applicationIdParamSchema,
    },
    responses: {
      200: { description: "Xóa thành công" },
      404: { description: "Không tìm thấy đơn ứng tuyển" },
    },
  });
}
