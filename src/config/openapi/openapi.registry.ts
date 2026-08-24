import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Kích hoạt tính năng OpenAPI mở rộng cho Zod
extendZodWithOpenApi(z);

export const openapiRegistry = new OpenAPIRegistry();

// ── 1. Đăng ký Security Schemes ──────────────────────────────────────────────
export const BearerAuth = openapiRegistry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Sử dụng header Authorization: Bearer <accessToken>',
});

export const ApiKeyAuth = openapiRegistry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'x-api-key',
  description: 'API Key xác thực dành cho hệ thống bên thứ ba (Third-Party Integration)',
});

// ── 2. Đăng ký Common Component Schemas ───────────────────────────────────────
export const SuccessResponseSchema = openapiRegistry.register(
  'SuccessResponse',
  z.object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().optional().openapi({ example: 'Operation completed successfully' }),
  }),
);

export const PaginationMetaSchema = openapiRegistry.register(
  'PaginationMeta',
  z.object({
    total: z.number().int().openapi({ example: 42 }),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 20 }),
    totalPages: z.number().int().openapi({ example: 3 }),
  }),
);

export const ErrorResponseSchema = openapiRegistry.register(
  'ErrorResponse',
  z.object({
    success: z.boolean().openapi({ example: false }),
    message: z.string().openapi({ example: 'Detailed error description' }),
    code: z.string().openapi({ example: 'RESOURCE_NOT_FOUND' }),
    data: z.record(z.unknown()).optional(),
  }),
);

export const ValidationErrorResponseSchema = openapiRegistry.register(
  'ValidationErrorResponse',
  z.object({
    success: z.boolean().openapi({ example: false }),
    message: z.string().openapi({ example: 'Validation error' }),
    code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
    errors: z
      .array(
        z.object({
          field: z.string().openapi({ example: 'email' }),
          message: z.string().openapi({ example: 'Invalid email format' }),
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
    openapi: '3.0.0',
    info: {


      title: 'Backend REST API',
      version: '1.0.0',
      description:
        'Backend REST API Template (NodeJS, Express, TypeScript, Prisma, PostgreSQL). Cung cấp hệ thống xác thực, quản lý người dùng, Dynamic RBAC, Chế độ bảo trì hệ thống, Integrations & Webhooks, và System Configuration.',
      contact: { name: 'Development Team' },
    },
    servers: [{ url: '/api/v1', description: 'API v1 Root' }],
  });
}
