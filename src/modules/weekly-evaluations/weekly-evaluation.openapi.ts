import { z } from "zod";
import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  aiSuggestSchema,
  createWeeklyEvaluationSchema,
  queryWeeklyEvaluationSchema,
  updateWeeklyEvaluationSchema,
} from "./weekly-evaluation.validation";

export function registerWeeklyEvaluationOpenApi(): void {
  openapiRegistry.register("CreateWeeklyEvaluationRequest", createWeeklyEvaluationSchema);
  openapiRegistry.register("UpdateWeeklyEvaluationRequest", updateWeeklyEvaluationSchema);
  openapiRegistry.register("AiSuggestWeeklyEvaluationRequest", aiSuggestSchema);

  // POST /weekly-evaluations/ai-suggest
  openapiRegistry.registerPath({
    method: "post",
    path: "/weekly-evaluations/ai-suggest",
    tags: ["Weekly Evaluations"],
    summary: "Trợ lý AI gợi ý xếp loại 12 tiêu chí và viết sẵn nhận xét đánh giá tuần",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: aiSuggestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Gợi ý AI thành công",
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

  // GET /weekly-evaluations/intern/{internId}/summary
  openapiRegistry.registerPath({
    method: "get",
    path: "/weekly-evaluations/intern/{internId}/summary",
    tags: ["Weekly Evaluations"],
    summary: "Tổng hợp điểm trung bình, xếp loại và lịch sử 6 tuần gần nhất của TTS",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ internId: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Tổng hợp thành công",
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

  // GET /weekly-evaluations
  openapiRegistry.registerPath({
    method: "get",
    path: "/weekly-evaluations",
    tags: ["Weekly Evaluations"],
    summary: "Danh sách đánh giá tuần phân trang và lọc",
    security: [{ BearerAuth: [] }],
    request: {
      query: queryWeeklyEvaluationSchema,
    },
    responses: {
      200: {
        description: "Danh sách đánh giá tuần",
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

  // POST /weekly-evaluations
  openapiRegistry.registerPath({
    method: "post",
    path: "/weekly-evaluations",
    tags: ["Weekly Evaluations"],
    summary: "Leader tạo đánh giá tuần cho TTS (12 tiêu chí, điểm TB, nhận xét)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createWeeklyEvaluationSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Tạo đánh giá tuần thành công",
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

  // GET /weekly-evaluations/{id}
  openapiRegistry.registerPath({
    method: "get",
    path: "/weekly-evaluations/{id}",
    tags: ["Weekly Evaluations"],
    summary: "Chi tiết đánh giá tuần (bảng 12 tiêu chí, nhận xét Leader, nhận xét gốc AI)",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Chi tiết đánh giá tuần",
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

  // PUT /weekly-evaluations/{id}
  openapiRegistry.registerPath({
    method: "put",
    path: "/weekly-evaluations/{id}",
    tags: ["Weekly Evaluations"],
    summary: "Cập nhật đánh giá tuần",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: updateWeeklyEvaluationSchema,
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

  // DELETE /weekly-evaluations/{id}
  openapiRegistry.registerPath({
    method: "delete",
    path: "/weekly-evaluations/{id}",
    tags: ["Weekly Evaluations"],
    summary: "Xóa đánh giá tuần",
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

  // POST /weekly-evaluations/{id}/confirm-view
  openapiRegistry.registerPath({
    method: "post",
    path: "/weekly-evaluations/{id}/confirm-view",
    tags: ["Weekly Evaluations"],
    summary: "TTS bấm 'Đã xem đánh giá' để xác nhận đã đọc",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Xác nhận đã xem thành công",
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
}
