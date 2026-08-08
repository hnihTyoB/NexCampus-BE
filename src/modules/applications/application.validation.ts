import { z } from "zod";
import { APPLICATION_STATUS, APPLICATION_INVITE_STATUS } from "../../common/constants/status.constant";
import { VIETNAMESE_PHONE_REGEX } from "../../common/helpers/phone.helper";
import {
  APPLICATION_PREFERRED_DEPARTMENTS,
  isValidApplicationPreference,
} from "./application-preference.constant";

const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

function getBusinessToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export const findAllApplicationSchema = z.object({
  status: z.enum([APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED]).optional(),
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
  phone: z.string().regex(VIETNAMESE_PHONE_REGEX, "Số điện thoại không đúng định dạng Việt Nam"),
  preferredDepartment: z.enum(APPLICATION_PREFERRED_DEPARTMENTS),
  preferredPosition: z.string().trim().min(1, "Preferred position is required"),
  startDate: z
    .string()
    .refine((value) => parseDateOnly(value) !== null, {
      message: "startDate must be a valid date in YYYY-MM-DD format",
    })
    .refine(
      (value) => !parseDateOnly(value) || value >= getBusinessToday(),
      { message: "Start date cannot be in the past" },
    )
    .refine((value) => {
      const date = parseDateOnly(value);
      return !date || ![0, 6].includes(date.getUTCDay());
    }, "Start date cannot be Saturday or Sunday"),
  duration: z.preprocess(
    (val) => (typeof val === "string" ? parseInt(val, 10) : val),
    z
      .number({ invalid_type_error: "Duration must be a number" })
      .int()
      .positive("Duration must be a positive integer")
  ),
  token: z.string().min(1, "Invitation token is required"),
  regulationId: z.string().uuid("Invalid regulation ID"),
  acceptedRegulations: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().refine((val) => val === true, {
      message: "You must accept the regulations to submit the application",
    })
  ),
  uploadedFiles: z
    .array(
      z.object({
        fileName: z.string().min(1),
        filePath: z.string().min(1),
        mimeType: z.string().min(1),
        fileSize: z.number().int().positive(),
      })
    )
    .optional(),
}).superRefine((data, ctx) => {
  if (!isValidApplicationPreference(data.preferredDepartment, data.preferredPosition)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["preferredPosition"],
      message: "Position is not available for the selected department",
    });
  }
});

export const reviewApplicationSchema = z.object({
  status: z.enum([APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED], {
    errorMap: () => ({ message: `status must be ${APPLICATION_STATUS.APPROVED} or ${APPLICATION_STATUS.REJECTED}` }),
  }),
});

export const assignApplicationSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID").nullable(),
  positionId: z.string().uuid("Invalid position ID").nullable(),
}).superRefine((data, ctx) => {
  if (!data.departmentId && data.positionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["positionId"],
      message: "A department is required before assigning a position",
    });
  }
});

export const createInviteSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

export const getApplicationInvitesSchema = z.object({
  email: z.string().optional(),
  inviteStatus: z.enum([
    APPLICATION_INVITE_STATUS.ACTIVE,
    APPLICATION_INVITE_STATUS.USED,
    APPLICATION_INVITE_STATUS.EXPIRED,
    APPLICATION_INVITE_STATUS.REVOKED,
  ]).optional(),
  applicationStatus: z.enum([
    APPLICATION_STATUS.PENDING,
    APPLICATION_STATUS.APPROVED,
    APPLICATION_STATUS.REJECTED,
  ]).optional(),
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
