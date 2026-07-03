import { z } from 'zod';

export const updateNotificationSettingSchema = z.object({
  webEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  discordEnabled: z.boolean().optional(),
});
