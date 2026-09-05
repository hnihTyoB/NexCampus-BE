import { z } from "zod";
import {
  VIETNAM_DATE_REGEX,
  ISO_DATE_REGEX,
} from "../../common/constants/date.constant";

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Tên vai trò tối thiểu 2 ký tự")
    .max(50, "Tên vai trò tối đa 50 ký tự")
    .regex(
      /^[A-Z0-9_]+$/,
      "Tên vai trò chỉ được gồm chữ hoa, số và dấu gạch dưới (VD: ACCOUNTANT, AUDITOR)",
    ),
  description: z.string().max(255, "Mô tả tối đa 255 ký tự").optional(),
  permissionIds: z
    .array(z.string().uuid("Permission ID không hợp lệ"))
    .optional(),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Tên vai trò tối thiểu 2 ký tự")
    .max(50, "Tên vai trò tối đa 50 ký tự")
    .regex(
      /^[A-Z0-9_]+$/,
      "Tên vai trò chỉ được gồm chữ hoa, số và dấu gạch dưới",
    )
    .optional(),
  description: z.string().max(255, "Mô tả tối đa 255 ký tự").optional(),
});

export const assignPermissionsSchema = z.object({
  permissionIds: z
    .array(z.string().uuid("Permission ID không hợp lệ"))
    .min(1, "Cần ít nhất một permission ID"),
});

export const assignUserRoleSchema = z.object({
  roleId: z.string().uuid("Role ID không hợp lệ"),
});

export const roleIdParamSchema = z.object({
  id: z.string().uuid("Role ID không hợp lệ"),
});

export const rolePermissionParamsSchema = z.object({
  id: z.string().uuid("Role ID không hợp lệ"),
  permissionId: z.string().uuid("Permission ID không hợp lệ"),
});

export const roleQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(["name", "createdAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});


export const auditLogQuerySchema = z.object({
  actorId: z.string().uuid("Actor ID không hợp lệ").optional(),
  action: z.string().max(100).optional(),
  targetType: z.string().max(100).optional(),
  targetId: z.string().max(100).optional(),
  startDate: z
    .string()
    .max(50, "startDate tối đa 50 ký tự")
    .refine(
      (val) =>
        !val ||
        VIETNAM_DATE_REGEX.test(val) ||
        ISO_DATE_REGEX.test(val) ||
        !isNaN(Date.parse(val)),
      {
        message:
          "startDate phải là định dạng DD/MM/YYYY, YYYY-MM-DD hoặc ISO 8601 hợp lệ",
      },
    )
    .optional(),
  endDate: z
    .string()
    .max(50, "endDate tối đa 50 ký tự")
    .refine(
      (val) =>
        !val ||
        VIETNAM_DATE_REGEX.test(val) ||
        ISO_DATE_REGEX.test(val) ||
        !isNaN(Date.parse(val)),
      {
        message:
          "endDate phải là định dạng DD/MM/YYYY, YYYY-MM-DD hoặc ISO 8601 hợp lệ",
      },
    )
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const permissionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  resource: z
    .string()
    .max(50, "Resource tối đa 50 ký tự")
    .regex(
      /^[a-z0-9_:-]+$/i,
      "Resource chỉ gồm chữ cái, số, dấu gạch và hai chấm",
    )
    .optional(),
});

