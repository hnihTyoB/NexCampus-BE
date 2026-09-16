import { z } from "zod";

export const regulationIdParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

export const createRegulationSchema = z.object({
  title: z
    .string()
    .min(3, "Tiêu đề nội quy phải từ 3 ký tự trở lên")
    .max(255, "Tiêu đề không quá 255 ký tự"),
  content: z.string().min(10, "Nội dung quy định phải từ 10 ký tự trở lên"),
  isActive: z.boolean().optional(),
});

export const updateRegulationSchema = z.object({
  title: z
    .string()
    .min(3, "Tiêu đề nội quy phải từ 3 ký tự trở lên")
    .max(255, "Tiêu đề không quá 255 ký tự")
    .optional(),
  content: z.string().min(10, "Nội dung quy định phải từ 10 ký tự trở lên").optional(),
  isActive: z.boolean().optional(),
});

export const regulationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  title: z.string().optional(),
  isActive: z
    .preprocess((val) => {
      if (typeof val === "string") {
        if (val.toLowerCase() === "true") return true;
        if (val.toLowerCase() === "false") return false;
      }
      return val;
    }, z.boolean().optional())
    .optional(),
});

export type RegulationIdParamInput = z.infer<typeof regulationIdParamSchema>;
export type CreateRegulationInput = z.infer<typeof createRegulationSchema>;
export type UpdateRegulationInput = z.infer<typeof updateRegulationSchema>;
export type RegulationQueryInput = z.infer<typeof regulationQuerySchema>;
