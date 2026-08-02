import { z } from "zod";
import { INTERN_STATUS } from "../../common/constants/status.constant";
import { VIETNAMESE_PHONE_REGEX } from "../../common/helpers/phone.helper";

export const findAllInternSchema = z.object({
  fullName: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  status: z.enum([INTERN_STATUS.ACTIVE, INTERN_STATUS.COMPLETED, INTERN_STATUS.DROPPED]).optional(),
  leaderId: z.string().uuid("Invalid leaderId").optional(),
  leader: z.string().optional(),
  discordRoleGranted: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
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

  sortBy: z.enum(["createdAt", "fullName", "startDate", "status"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),

  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createInternSchema = z.object({
  userId: z.string().uuid("Invalid userId"),
  leaderId: z.string().uuid("Invalid leaderId").optional(),
  fullName: z.string().min(1, "Full name is required").max(100),
  phone: z.string().regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam"),
  departmentId: z.string().uuid("Invalid departmentId"),
  positionId: z.string().uuid("Invalid positionId"),
  startDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "startDate must be a valid ISO date",
  }),
  duration: z.number().int().positive("Duration must be a positive integer"),
  discordUsername: z.string().optional(),
});

export const directCreateInternSchema = createInternSchema
  .omit({ userId: true })
  .extend({
    email: z.string().trim().email("Invalid email").max(255),
  });

export const updateInternSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  phone: z.string().regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam").optional(),
  departmentId: z.string().uuid().nullable().optional(),
  positionId: z.string().uuid().nullable().optional(),
  leaderId: z.string().uuid().nullable().optional(),
  startDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid date" })
    .optional(),
  duration: z.number().int().positive().optional(),
  discordUsername: z.string().nullable().optional(),
  discordRoleGranted: z.boolean().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "DROPPED"]).optional(),
});

export const assignLeaderSchema = z.object({
  leaderId: z.string().uuid("Invalid leaderId").nullable(),
});

export const updateMeInternSchema = z.object({
  phone: z.string().regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam").optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  discordUsername: z.string().nullable().optional(),
});
