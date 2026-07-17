import { z } from "zod";

export const findAllNotificationSchema = z.object({
  userId: z.string().uuid().optional(),
  isRead: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  type: z.string().optional(),
  sortBy: z.enum(["createdAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  type: z.string().min(1).max(50),
});

export const sendCustomNotificationSchema = z.object({
  email: z.string().email(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  emailSubject: z.string().max(200).optional(),
  emailContent: z.string().max(5000).optional(),
  sendWeb: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
});
