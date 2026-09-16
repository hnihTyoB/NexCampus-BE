import { z } from "zod";
import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  calendarDailyReportSchema,
  createDailyReportSchema,
  feedbackDailyReportSchema,
  queryDailyReportSchema,
  updateDailyReportSchema,
  uploadReportUrlSchema,
} from "./daily-report.validation";

export function registerDailyReportOpenApi(): void {
  openapiRegistry.register("CreateDailyReportRequest", createDailyReportSchema);
  openapiRegistry.register("UpdateDailyReportRequest", updateDailyReportSchema);
  openapiRegistry.register("FeedbackDailyReportRequest", feedbackDailyReportSchema);
  openapiRegistry.register("UploadReportUrlRequest", uploadReportUrlSchema);

  // POST /daily-reports/upload-url
  openapiRegistry.registerPath({
    method: "post",
    path: "/daily-reports/upload-url",
    tags: ["DailyReports"],
    summary: "Lấy link presigned upload tệp đính kèm báo cáo ngày (Cloudflare R2 prefix reports/)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: uploadReportUrlSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Sinh URL upload thành công",
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

  // GET /daily-reports/calendar
  openapiRegistry.registerPath({
    method: "get",
    path: "/daily-reports/calendar",
    tags: ["DailyReports"],
    summary: "Lấy dữ liệu lịch nộp báo cáo theo tháng và thống kê",
    security: [{ BearerAuth: [] }],
    request: {
      query: calendarDailyReportSchema,
    },
    responses: {
      200: {
        description: "Dữ liệu lịch nộp thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                internId: z.string(),
                month: z.number(),
                year: z.number(),
                totalWorkingDays: z.number(),
                reportedDays: z.number(),
                missingDays: z.number(),
                submissionRate: z.number(),
                days: z.array(z.record(z.unknown())),
              }),
            }),
          },
        },
      },
    },
  });

  // GET /daily-reports
  openapiRegistry.registerPath({
    method: "get",
    path: "/daily-reports",
    tags: ["DailyReports"],
    summary: "Danh sách báo cáo ngày phân trang và lọc",
    security: [{ BearerAuth: [] }],
    request: {
      query: queryDailyReportSchema,
    },
    responses: {
      200: {
        description: "Danh sách báo cáo ngày",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              items: z.array(z.record(z.unknown())),
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
            }),
          },
        },
      },
    },
  });

  // POST /daily-reports
  openapiRegistry.registerPath({
    method: "post",
    path: "/daily-reports",
    tags: ["DailyReports"],
    summary: "TTS nộp báo cáo ngày (upsert 1 báo cáo/ngày theo giờ VN)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createDailyReportSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Nộp báo cáo ngày thành công",
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

  // GET /daily-reports/{id}
  openapiRegistry.registerPath({
    method: "get",
    path: "/daily-reports/{id}",
    tags: ["DailyReports"],
    summary: "Chi tiết báo cáo ngày",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Chi tiết báo cáo ngày",
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

  // PUT /daily-reports/{id}
  openapiRegistry.registerPath({
    method: "put",
    path: "/daily-reports/{id}",
    tags: ["DailyReports"],
    summary: "Chỉnh sửa báo cáo ngày",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: updateDailyReportSchema,
          },
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
    },
  });

  // DELETE /daily-reports/{id}
  openapiRegistry.registerPath({
    method: "delete",
    path: "/daily-reports/{id}",
    tags: ["DailyReports"],
    summary: "Xóa báo cáo ngày",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
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
    },
  });

  // POST /daily-reports/{id}/feedback
  openapiRegistry.registerPath({
    method: "post",
    path: "/daily-reports/{id}/feedback",
    tags: ["DailyReports"],
    summary: "Leader/Admin gửi nhận xét, phản hồi cho báo cáo ngày",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: feedbackDailyReportSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Phản hồi thành công",
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

  // DELETE /daily-reports/attachments/{attachmentId}
  openapiRegistry.registerPath({
    method: "delete",
    path: "/daily-reports/attachments/{attachmentId}",
    tags: ["DailyReports"],
    summary: "Xóa tệp đính kèm của báo cáo ngày",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ attachmentId: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Xóa tệp thành công",
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
