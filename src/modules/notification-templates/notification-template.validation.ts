import { z } from "zod";

export const createNotificationTemplateSchema = z.object({
  type: z.string().min(1).max(50),
  titleTemplate: z.string().max(200).optional().default(""),
  contentTemplate: z.string().max(2000).optional().default(""),
  emailSubjectTemplate: z.string().max(200).nullable().optional(),
  emailContentTemplate: z.string().max(10000).nullable().optional(),
});

export const updateNotificationTemplateSchema = z.object({
  titleTemplate: z.string().max(200).nullable().optional(),
  contentTemplate: z.string().max(2000).nullable().optional(),
  emailSubjectTemplate: z.string().max(200).nullable().optional(),
  emailContentTemplate: z.string().max(10000).nullable().optional(),
});

export const upsertByTypeSchema = z.object({
  titleTemplate: z.string().max(200).optional().default(""),
  contentTemplate: z.string().max(2000).optional().default(""),
  emailSubjectTemplate: z.string().max(200).nullable().optional(),
  emailContentTemplate: z.string().max(10000).nullable().optional(),
});
