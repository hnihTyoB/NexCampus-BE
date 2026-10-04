import { prisma } from "../../database/prisma.client";
import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

// Vietnamese mobile phone number format:
// Starts with 0, +84, or 84, followed by 3, 5, 7, 8, or 9, followed by 8 digits
export const VIETNAMESE_PHONE_REGEX = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;

export async function validatePhoneUniqueness(
  phone?: string | null,
  exclude?: { userId?: string; internId?: string; leaderId?: string },
): Promise<void> {
  if (!phone) return;

  const excludeUserId = exclude?.userId || exclude?.internId || exclude?.leaderId;

  const existingUser = await prisma.user.findFirst({
    where: {
      phoneNumber: phone,
      deletedAt: null,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });

  if (existingUser) {
    throw new AppError(
      "Số điện thoại này đã được sử dụng bởi một tài khoản khác trong hệ thống.",
      409,
      ERROR_CODE.DUPLICATE_ENTRY,
    );
  }
}

