import { z } from "zod";

const cleanText = (val: string) => val.replace(/<[^>]*>/g, "").trim();

export const createRegulationSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  content: z.string().trim().min(1, "Content is required").max(150000, "Content is too long").refine(
    (val) => cleanText(val).length > 0,
    { message: "Content cannot be empty" }
  ),
  isActive: z.boolean().optional(),
});

export const updateRegulationSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255).optional(),
  content: z.string().trim().min(1, "Content is required").max(150000, "Content is too long").optional().refine(
    (val) => val === undefined || cleanText(val).length > 0,
    { message: "Content cannot be empty" }
  ),
  isActive: z.boolean().optional(),
});
