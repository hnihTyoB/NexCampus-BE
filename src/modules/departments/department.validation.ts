import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  positions: z.array(z.string().trim().min(1)).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Department name cannot be empty").max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const findAllDepartmentSchema = z.object({
  name: z.string().optional(),
  leader: z.string().optional(),
});

export const departmentIdParamSchema = z.object({
  id: z.string().uuid("Invalid departmentId"),
});

export const createPositionSchema = z.object({
  departmentId: z.string().uuid("Invalid departmentId").optional(),
  name: z.string().trim().min(1, "Position name is required").max(100),
});

export const updatePositionSchema = z.object({
  departmentId: z.string().uuid("Invalid departmentId").optional(),
  name: z.string().trim().min(1, "Position name cannot be empty").max(100).optional(),
});

export const positionIdParamSchema = z.object({
  id: z.string().uuid("Invalid positionId"),
});
