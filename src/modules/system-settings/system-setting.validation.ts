import { z } from "zod";

export const settingKeyParamSchema = z.object({
  key: z.string().min(1, "Setting key is required"),
});

export const updateSystemSettingSchema = z.object({
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
  ]),
  description: z.string().optional(),
  category: z.string().optional(),
});

export const batchUpdateSystemSettingsSchema = z.object({
  settings: z.record(
    z.union([z.string(), z.number(), z.boolean()])
  ),
});

export type SettingKeyParamInput = z.infer<typeof settingKeyParamSchema>;
export type UpdateSystemSettingInput = z.infer<typeof updateSystemSettingSchema>;
export type BatchUpdateSystemSettingsInput = z.infer<
  typeof batchUpdateSystemSettingsSchema
>;
