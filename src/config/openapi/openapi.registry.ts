import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Kích hoạt tính năng OpenAPI mở rộng cho Zod
extendZodWithOpenApi(z);

export const openapiRegistry = new OpenAPIRegistry();

// ── 1. Đăng ký Security Schemes ──────────────────────────────────────────────
export const BearerAuth = openapiRegistry.registerComponent(
  "securitySchemes",
  "BearerAuth",
  {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Sử dụng header Authorization: Bearer <accessToken>",
  },
);

export const ApiKeyAuth = openapiRegistry.registerComponent(
  "securitySchemes",
  "ApiKeyAuth",
  {
    type: "apiKey",
    in: "header",
    name: "x-api-key",
    description:
      "API Key xác thực dành cho hệ thống bên thứ ba (Third-Party Integration)",
  },
);

export const CookieAuth = openapiRegistry.registerComponent(
  "securitySchemes",
  "CookieAuth",
  {
    type: "apiKey",
    in: "cookie",
    name: "refreshToken",
    description: "Phiên làm việc xác thực bằng HttpOnly Cookie (refreshToken)",
  },
);

// ── 2. Đăng ký Common Component Schemas ───────────────────────────────────────
export const SuccessResponseSchema = openapiRegistry.register(
  "SuccessResponse",
  z.object({
    success: z.boolean().openapi({ example: true }),
    message: z
      .string()
      .optional()
      .openapi({ example: "Operation completed successfully" }),
  }),
);

export const PaginationMetaSchema = openapiRegistry.register(
  "PaginationMeta",
  z.object({
    total: z.number().int().openapi({ example: 42 }),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 20 }),
    totalPages: z.number().int().openapi({ example: 3 }),
  }),
);

export const ErrorResponseSchema = openapiRegistry.register(
  "ErrorResponse",
  z.object({
    success: z.boolean().openapi({ example: false }),
    message: z.string().openapi({ example: "Detailed error description" }),
    code: z.string().openapi({ example: "RESOURCE_NOT_FOUND" }),
    data: z.record(z.unknown()).optional(),
  }),
);

export const ValidationErrorResponseSchema = openapiRegistry.register(
  "ValidationErrorResponse",
  z.object({
    success: z.boolean().openapi({ example: false }),
    message: z.string().openapi({ example: "Validation error" }),
    code: z.string().openapi({ example: "VALIDATION_ERROR" }),
    errors: z
      .array(
        z.object({
          field: z.string().openapi({ example: "email" }),
          message: z.string().openapi({ example: "Invalid email format" }),
        }),
      )
      .optional(),
  }),
);

/**
 * Hàm biên dịch toàn bộ các định nghĩa route & schema đã đăng ký thành tài liệu chuẩn OpenAPI 3.0.0
 */
export function buildOpenApiSpec(): Record<string, any> {
  const generator = new OpenApiGeneratorV3(openapiRegistry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Backend REST API",
      version: "1.0.0",
      description:
        "Tài liệu đặc tả chuẩn OpenAPI của hệ thống Quản lý thực tập sinh NexCampus Enterprise v2 (NodeJS, Express, TypeScript, Prisma, PostgreSQL). Bao gồm Quản lý công việc & bài nộp, Báo cáo ngày, Đánh giá tuần 12 tiêu chí, Tuyển dụng, Lịch họp, Thống kê Dashboard, Xuất báo cáo PDF, Dynamic RBAC và Hàng đợi BullMQ.",
      contact: { name: "NexCampus Engineering Team" },
    },
    servers: [
      { url: "/api/v1", description: "API v1 Root" },
      { url: "/api/v2", description: "NexCampus v2 API Endpoint" },
    ],
    tags: [

      { name: "Authentication", description: "Xác thực, phân quyền token và quản lý phiên làm việc" },
      { name: "Users", description: "Quản lý hồ sơ người dùng và trạng thái tài khoản" },
      { name: "RBAC", description: "Phân quyền động: Danh mục vai trò và ma trận quyền hạn" },
      { name: "Departments", description: "Quản lý phòng ban và cơ cấu tổ chức doanh nghiệp" },
      { name: "Leaders", description: "Quản lý người hướng dẫn và quản lý chuyên môn" },
      { name: "Interns", description: "Quản lý hồ sơ thực tập sinh và tiến độ kỳ thực tập" },
      { name: "Applications", description: "Quy trình tuyển dụng và xét duyệt đơn ứng tuyển" },
      { name: "Task Groups", description: "Nhóm công việc theo dự án và đợt thực tập" },
      { name: "Tasks", description: "Quản lý công việc, deadline và phân công nhân sự" },
      { name: "Task Assignments", description: "Phân công công việc và kiểm soát tải (workload)" },
      { name: "Submissions", description: "Nộp bài, đính kèm kết quả và xét duyệt công việc" },
      { name: "DailyReports", description: "Báo cáo tiến độ hằng ngày và phản hồi của người hướng dẫn" },
      { name: "WeeklyEvaluations", description: "Đánh giá tuần 12 tiêu chí, gợi ý trợ lý AI và tổng kết" },
      { name: "Meetings", description: "Lịch họp, điểm danh và biên bản cuộc họp" },
      { name: "Absences", description: "Đơn xin nghỉ / vắng mặt và quy trình xét duyệt phép" },
      { name: "Notifications", description: "Hệ thống thông báo đẩy Server-Sent Events và thông báo Web" },
      { name: "Notification Settings", description: "Tùy biến nhận thông báo cá nhân của người dùng" },
      { name: "Notification Templates", description: "Quản lý mẫu thông báo và email hệ thống" },
      { name: "Stats", description: "Thống kê tổng hợp Dashboard đa phân hệ (Admin, Leader, Intern)" },
      { name: "PDF Export", description: "Xuất báo cáo đánh giá tuần và tổng kết thực tập ra file PDF chuẩn" },
      { name: "System Settings", description: "Cài đặt và quản lý tham số vận hành hệ thống" },
      { name: "Regulations", description: "Nội quy thực tập và theo dõi xác nhận tuân thủ chính sách" },
      { name: "Activity Logs", description: "Nhật ký kiểm toán và lịch sử hoạt động hệ thống" },
      { name: "Maintenance", description: "Quản lý chế độ bảo trì hệ thống và kiểm tra trạng thái" },
      { name: "Health & Diagnostics", description: "Giám sát tình trạng sức khỏe máy chủ và tài nguyên" },
    ],
  });
}

