import { z } from "zod";

export const findAllApplicationSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  email: z.string().email("Invalid email").optional(),
  startDateFrom: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), {
      message: "startDateFrom must be a valid ISO date",
    })
    .optional(),
  startDateTo: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), {
      message: "startDateTo must be a valid ISO date",
    })
    .optional(),
  sortBy: z.enum(["createdAt", "startDate", "fullName", "status"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createApplicationSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  phone: z.string().min(9, "Phone must be at least 9 digits").max(15),
  departmentId: z.string().uuid("Invalid department ID"),
  positionId: z.string().uuid("Invalid position ID"),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "startDate must be a valid ISO date string",
  }),
  duration: z
    .number({ invalid_type_error: "Duration must be a number" })
    .int()
    .positive("Duration must be a positive integer"),
  token: z.string().min(1, "Invitation token is required"),
  regulationId: z.string().uuid("Invalid regulation ID"),
  acceptedRegulations: z.boolean().refine((val) => val === true, {
    message: "You must accept the regulations to submit the application",
  }),
});

export const reviewApplicationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], {
    errorMap: () => ({ message: "status must be APPROVED or REJECTED" }),
  }),
});

export const createInviteSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

export const getApplicationInvitesSchema = z.object({
  email: z.string().optional(),
  inviteStatus: z.enum(["ACTIVE", "USED", "EXPIRED", "REVOKED"]).optional(),
  applicationStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  createdFrom: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), {
      message: "createdFrom must be a valid ISO date",
    })
    .optional(),
  createdTo: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), {
      message: "createdTo must be a valid ISO date",
    })
    .optional(),
  sortBy: z.enum(["createdAt", "expiresAt", "email"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

