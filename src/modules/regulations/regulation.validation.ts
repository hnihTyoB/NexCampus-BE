import { z } from "zod";

export const createRegulationSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content is required"),
  isActive: z.boolean().optional(),
});

export const updateRegulationSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).optional(),
  content: z.string().min(1, "Content is required").optional(),
  isActive: z.boolean().optional(),
});
