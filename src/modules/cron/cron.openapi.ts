import { openapiRegistry } from '../../config/openapi/openapi.registry';
import { cronJobNameParamSchema, triggerCronJobSchema, listCronJobsQuerySchema } from './cron.validation';
import { z } from 'zod';

export function registerCronOpenApi(): void {
  openapiRegistry.register('TriggerCronJobRequest', triggerCronJobSchema);

  // GET /cron/jobs
  openapiRegistry.registerPath({
    method: 'get',
    path: '/cron/jobs',
    tags: ['Scheduled Tasks & Cron Jobs'],
    summary: 'Danh sách toàn bộ các tác vụ nền định kỳ (Cron Jobs) trong hệ thống',
    security: [{ BearerAuth: [] }],
    request: { query: listCronJobsQuerySchema },
    responses: {
      200: {
        description: 'Lấy danh sách tác vụ thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  name: z.string().openapi({ example: 'cleanup-audit-logs' }),
                  cron: z.string().openapi({ example: '0 2 * * *' }),
                  description: z.string().openapi({ example: 'Dọn dẹp các bản ghi Audit Logs cũ hơn 30 ngày' }),
                  lastStatus: z.string().openapi({ example: 'READY' }),
                }),
              ),
            }),
          },
        },
      },
      403: { description: 'Không có quyền CRON_JOB_READ' },
    },
  });

  // POST /cron/jobs/:jobName/trigger
  openapiRegistry.registerPath({
    method: 'post',
    path: '/cron/jobs/{jobName}/trigger',
    tags: ['Scheduled Tasks & Cron Jobs'],
    summary: 'Kích hoạt chạy ngay một Cron Job bất kỳ (Manual Trigger từ Admin)',
    security: [{ BearerAuth: [] }],
    request: {
      params: cronJobNameParamSchema,
      body: { content: { 'application/json': { schema: triggerCronJobSchema } } },
    },
    responses: {
      200: {
        description: 'Tác vụ đã được thực thi thành công',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: "Tác vụ 'cleanup-audit-logs' đã được kích hoạt và thực thi thành công" }),
              data: z.object({
                jobName: z.string().openapi({ example: 'cleanup-audit-logs' }),
                success: z.boolean().openapi({ example: true }),
                durationMs: z.number().openapi({ example: 45 }),
                data: z.record(z.unknown()),
              }),
            }),
          },
        },
      },
      400: { description: 'Tên job không hợp lệ hoặc tham số không đúng định dạng' },
      403: { description: 'Không có quyền CRON_JOB_MANAGE' },
    },
  });
}
