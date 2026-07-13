import { z } from "zod";

export const findAllUserSchema = z.object({
  email: z.string().optional(),
  fullName: z.string().optional(),
  roleName: z.enum(["ADMIN", "LEADER", "INTERN"]).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),

  sortBy: z.enum(["createdAt", "email", "fullName"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),

  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
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
    )
    .optional(), 
    
  role: z.enum(["LEADER", "INTERN"], {
    errorMap: () => ({ message: "Role phải là LEADER hoặc INTERN" }),
  }),
});

// 2. CẬP NHẬT: Schema cập nhật thông tin User
export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  // Đồng bộ đổi sang kiểm tra chữ thay vì UUID
  role: z.enum(["LEADER", "INTERN"]).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character",
    ),
});