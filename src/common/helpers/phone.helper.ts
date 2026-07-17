import { prisma } from "../../database/prisma.client";
import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

// Vietnamese mobile phone number format:
// Starts with 0, +84, or 84, followed by 3, 5, 7, 8, or 9, followed by 8 digits
export const VIETNAMESE_PHONE_REGEX = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;

export async function validatePhoneUniqueness(
  phone?: string | null,
  exclude?: { internId?: string; leaderId?: string }
): Promise<void> {
  if (!phone) return;

  // 1. Check Intern table (excluding soft-deleted ones)
  const existingIntern = await prisma.intern.findFirst({
    where: {
      phone,
      deletedAt: null,
      ...(exclude?.internId ? { id: { not: exclude.internId } } : {}),
    },
  });
  if (existingIntern) {
    throw new AppError(
      "Số điện thoại này đã được sử dụng bởi một thực tập sinh khác.",
      409,
      ERROR_CODE.DUPLICATE_ENTRY,
    );
  }

  // 2. Check Leader table (no soft-delete since it deletes physically)
  const existingLeader = await prisma.leader.findFirst({
    where: {
      phone,
      ...(exclude?.leaderId ? { id: { not: exclude.leaderId } } : {}),
    },
  });
  if (existingLeader) {
    throw new AppError(
      "Số điện thoại này đã được sử dụng bởi một leader khác.",
      409,
      ERROR_CODE.DUPLICATE_ENTRY,
    );
  }
}
