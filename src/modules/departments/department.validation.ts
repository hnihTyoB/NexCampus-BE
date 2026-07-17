import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const createPositionSchema = z.object({
  departmentId: z.string().uuid("Invalid departmentId"),
  name: z.string().min(1, "Position name is required").max(100),
});

export const updatePositionSchema = z.object({
  departmentId: z.string().uuid("Invalid departmentId").optional(),
  name: z.string().min(1).max(100).optional(),
});
