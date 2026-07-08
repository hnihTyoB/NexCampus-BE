import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const updateMeSchema = z.object({
  fullName: z.string().min(1, "Full name is required").optional(),
  password: z.string().min(1, "Password is required").optional(),
  avatarUrl: z.string().url("Invalid URL format").optional(),
});
