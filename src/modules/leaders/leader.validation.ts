import { z } from "zod";
import { VIETNAMESE_PHONE_REGEX } from "../../common/helpers/phone.helper";
import { MAX_LEADER_DEPARTMENTS } from "./leader.dto";

const departmentIdsSchema = z
  .array(z.string().uuid("Invalid departmentId"))
  .max(
    MAX_LEADER_DEPARTMENTS,
    `A leader can manage at most ${MAX_LEADER_DEPARTMENTS} departments`,
  )
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "departmentIds must not contain duplicates",
  });

export const findAllLeaderSchema = z.object({
  fullName: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  department: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sortBy: z.enum(["createdAt", "fullName"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createLeaderSchema = z.object({
  userId: z.string().uuid("Invalid userId"),
  departmentIds: departmentIdsSchema.optional(),
  departmentId: z.string().uuid().optional(),
  position: z.string().max(100).optional(),
  phone: z.string().regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam").optional(),
});

export const updateLeaderSchema = z.object({
  departmentIds: departmentIdsSchema.optional(),
  departmentId: z.string().uuid().nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  phone: z.string().regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam").optional(),
});

export const updateMeLeaderSchema = z.object({
  phone: z
    .string()
    .regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam")
    .nullable()
    .optional(),
});
