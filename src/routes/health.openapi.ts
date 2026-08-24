import { openapiRegistry } from '../config/openapi/openapi.registry';
import { z } from 'zod';

export function registerHealthOpenApi(): void {
  // GET /health
  openapiRegistry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['Health & Diagnostics'],
    summary: 'Kiểm tra trạng thái máy chủ (Liveness probe)',
    responses: {
      200: {
        description: 'Máy chủ hoạt động bình thường',
        content: {
          'application/json': {
            schema: z.object({
              status: z.string().openapi({ example: 'ok' }),
              timestamp: z.string().datetime(),
              environment: z.string().openapi({ example: 'development' }),
            }),
          },
        },
      },
    },
  });

  // GET /health/liveness
  openapiRegistry.registerPath({
    method: 'get',
    path: '/health/liveness',
    tags: ['Health & Diagnostics'],
    summary: 'Liveness probe dành cho Kubernetes / Docker health checks',
    responses: {
      200: {
        description: 'Liveness OK',
        content: {
          'application/json': {
            schema: z.object({
              status: z.string().openapi({ example: 'ok' }),
              uptime: z.number().openapi({ example: 123.45 }),
              timestamp: z.string().datetime(),
            }),
          },
        },
      },
    },
  });

  // GET /health/readiness
  openapiRegistry.registerPath({
    method: 'get',
    path: '/health/readiness',
    tags: ['Health & Diagnostics'],
    summary: 'Readiness probe sâu (Kiểm tra kết nối PostgreSQL live, Redis live, Bộ nhớ Heap/RSS, Uptime)',
    responses: {
      200: {
        description: 'Hệ thống sẵn sàng nhận traffic',
        content: {
          'application/json': {
            schema: z.object({
              status: z.string().openapi({ example: 'ready' }),
              timestamp: z.string().datetime(),
              services: z.object({
                database: z.object({
                  status: z.string().openapi({ example: 'connected' }),
                  latencyMs: z.number().openapi({ example: 4.2 }),
                }),
                redis: z.object({
                  status: z.string().openapi({ example: 'connected' }),
                }),
              }),
              system: z.object({
                memory: z.object({
                  heapUsedMb: z.number().openapi({ example: 45.2 }),
                  heapTotalMb: z.number().openapi({ example: 60.5 }),
                  rssMb: z.number().openapi({ example: 85.1 }),
                }),
                uptimeSeconds: z.number().openapi({ example: 3600 }),
              }),
            }),
          },
        },
      },
      503: { description: 'Hệ thống chưa sẵn sàng (Mất kết nối Database hoặc Redis)' },
    },
  });
}
