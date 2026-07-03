import { z } from 'zod';

export const updateNotificationTemplateSchema = z.object({
  titleTemplate: z.string().min(1).max(200).optional(),
  contentTemplate: z.string().min(1).max(2000).optional(),
});
