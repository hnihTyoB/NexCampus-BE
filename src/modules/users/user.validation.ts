import { z } from "zod";

export const findAllUserSchema = z.object({
  email: z.string().optional(),
  fullName: z.string().optional(),
  roleName: z.string().optional(),
  excludeRoles: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),

  sortBy: z.enum(["createdAt", "email", "fullName"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),

  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
});

export const createUserSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character",
    ),
  roleId: z.string().uuid("Invalid roleId format"),
  fullName: z.string().trim().min(1).max(100).optional(),
  phoneNumber: z
    .string()
    .regex(/^[0-9]{10,11}$/, "Invalid phone number format")
    .optional(),
});

export const updateUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    fullName: z.string().trim().min(1).max(100).optional(),
    phoneNumber: z
      .string()
      .regex(/^[0-9]{10,11}$/, "Invalid phone number format")
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Ít nhất một trường cần được cung cấp để cập nhật",
  );

export const userSessionParamsSchema = z.object({
  id: z.string().uuid("ID người dùng phải là UUID hợp lệ"),
  sessionId: z.string().uuid("ID phiên đăng nhập phải là UUID hợp lệ"),
});

export const userDeviceParamsSchema = z.object({
  id: z.string().uuid("ID người dùng phải là UUID hợp lệ"),
  deviceId: z.string().uuid("ID thiết bị phải là UUID hợp lệ"),
});
