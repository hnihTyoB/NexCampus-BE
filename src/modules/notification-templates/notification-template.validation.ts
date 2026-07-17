import { z } from "zod";

export const createNotificationTemplateSchema = z.object({
  type: z.string().min(1).max(50),
  titleTemplate: z.string().min(1).max(200),
  contentTemplate: z.string().min(1).max(2000),
  emailSubjectTemplate: z.string().min(1).max(200).optional(),
  emailContentTemplate: z.string().min(1).max(5000).optional(),
});

export const updateNotificationTemplateSchema = z.object({
  titleTemplate: z.string().min(1).max(200).optional(),
  contentTemplate: z.string().min(1).max(2000).optional(),
  emailSubjectTemplate: z.string().min(1).max(200).nullable().optional(),
  emailContentTemplate: z.string().min(1).max(5000).nullable().optional(),
});

export const upsertByTypeSchema = z.object({
  titleTemplate: z.string().min(1).max(200),
  contentTemplate: z.string().min(1).max(2000),
  emailSubjectTemplate: z.string().min(1).max(200).nullable().optional(),
  emailContentTemplate: z.string().min(1).max(5000).nullable().optional(),
});
