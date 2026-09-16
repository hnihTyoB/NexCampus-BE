import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  exportWeeklyEvaluationParamSchema,
  exportInternshipSummaryParamSchema,
} from "./pdf-export.validation";
import { z } from "zod";

export function registerPdfExportOpenApi(): void {
  // POST /pdf-export/weekly-evaluation/:id
  openapiRegistry.registerPath({
    method: "post",
    path: "/pdf-export/weekly-evaluation/{id}",
    tags: ["PDF Export"],
    summary: "Xuất phiếu đánh giá tuần của TTS thành tệp PDF",
    security: [{ BearerAuth: [] }],
    request: {
      params: exportWeeklyEvaluationParamSchema,
    },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
              data: z.object({
                fileUrl: z.string().url(),
                fileName: z.string(),
                expiresAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });

  // POST /pdf-export/internship-summary/:internId
  openapiRegistry.registerPath({
    method: "post",
    path: "/pdf-export/internship-summary/{internId}",
    tags: ["PDF Export"],
    summary: "Xuất bảng tổng hợp kết quả thực tập cuối kỳ thành tệp PDF",
    security: [{ BearerAuth: [] }],
    request: {
      params: exportInternshipSummaryParamSchema,
    },
    responses: {
      200: {
        description: "Thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string(),
              data: z.object({
                fileUrl: z.string().url(),
                fileName: z.string(),
                expiresAt: z.string().datetime(),
              }),
            }),
          },
        },
      },
    },
  });
}
