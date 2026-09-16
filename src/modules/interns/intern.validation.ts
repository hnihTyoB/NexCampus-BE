import { z } from "zod";
import { INTERN_STATUS } from "../../common/constants/intern.constant";
import { VIETNAMESE_PHONE_REGEX } from "../../common/helpers/phone.helper";

export const findAllInternSchema = z.object({
  search: z.string().trim().optional(),
  internCode: z.string().trim().optional(),
  fullName: z.string().trim().optional(),
  university: z.string().trim().optional(),
  major: z.string().trim().optional(),
  departmentId: z.string().uuid("Invalid departmentId").optional(),
  positionId: z.string().uuid("Invalid positionId").optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  status: z
    .enum([
      INTERN_STATUS.ACTIVE,
      INTERN_STATUS.COMPLETED,
      INTERN_STATUS.DROPPED,
    ])
    .optional(),
  leaderId: z.string().uuid("Invalid leaderId").optional(),
  leader: z.string().optional(),
  discordRoleGranted: z
    .preprocess((val) => {
      if (typeof val === "string") return val.toLowerCase() === "true";
      return val;
    }, z.boolean())
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

  sortBy: z
    .enum(["createdAt", "fullName", "startDate", "status", "internCode"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),

  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const lookupAssignmentInternSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
});

export const createInternSchema = z.object({
  userId: z.string().uuid("Invalid userId"),
  leaderId: z.string().uuid("Invalid leaderId").optional(),
  fullName: z.string().trim().min(1, "Full name is required").max(100),
  phone: z
    .string()
    .regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam"),
  departmentId: z.string().uuid("Invalid departmentId"),
  positionId: z.string().uuid("Invalid positionId"),
  startDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "startDate must be a valid ISO date",
  }),
  duration: z.coerce
    .number()
    .int()
    .positive("Duration must be a positive integer")
    .optional(),
  discordUsername: z.string().optional(),
  internCode: z.string().trim().optional(),
  university: z.string().trim().optional(),
  major: z.string().trim().optional(),
});

export const directCreateInternSchema = createInternSchema
  .omit({ userId: true })
  .extend({
    email: z.string().trim().email("Invalid email").max(255),
  });

export const updateInternSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam")
    .optional(),
  departmentId: z.string().uuid("Invalid departmentId").nullable().optional(),
  positionId: z.string().uuid("Invalid positionId").nullable().optional(),
  leaderId: z.string().uuid("Invalid leaderId").nullable().optional(),
  startDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid date" })
    .optional(),
  duration: z.coerce.number().int().positive().optional(),
  discordUsername: z.string().nullable().optional(),
  discordRoleGranted: z.boolean().optional(),
  status: z
    .enum([
      INTERN_STATUS.ACTIVE,
      INTERN_STATUS.COMPLETED,
      INTERN_STATUS.DROPPED,
    ])
    .optional(),
  internCode: z.string().trim().nullable().optional(),
  university: z.string().trim().nullable().optional(),
  major: z.string().trim().nullable().optional(),
});

export const assignLeaderSchema = z.object({
  leaderId: z.string().uuid("Invalid leaderId").nullable(),
});

export const updateMeInternSchema = z.object({
  phone: z
    .string()
    .regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam")
    .optional(),
  // departmentId và positionId bị loại bỏ có chủ đích:
  // Intern không được tự chuyển phòng ban hoặc vị trí (SEC-03).
  // Chỉ Admin/Manager mới được thay đổi qua endpoint quản lý.
  discordUsername: z.string().nullable().optional(),
  university: z.string().trim().nullable().optional(),
  major: z.string().trim().nullable().optional(),
});

export const internIdParamSchema = z.object({
  id: z.string().uuid("Invalid internId"),
});
