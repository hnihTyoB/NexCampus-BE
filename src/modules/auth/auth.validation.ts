import { z } from "zod";
import { isPublicHttpUrl } from "../../common/helpers/url.helper";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export const revokeOtherSessionsSchema = z.object({
  refreshToken: z.string().optional(),
});

export const registerSchema = z.object({
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
  fullName: z.string().optional(),
});

export const sessionIdParamSchema = z.object({
  id: z.string().uuid("Invalid session ID format"),
});

export const verifyEmailSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "Invalid verification token format")
    .max(256, "Token exceeds maximum length"),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name cannot be empty").optional(),
  avatarUrl: z
    .string()
    .refine(
      (url) => url === "" || isPublicHttpUrl(url),
      "avatarUrl must be a valid public HTTPS URL (private IP and localhost are not allowed in production)",
    )
    .optional(),
  phoneNumber: z
    .string()
    .regex(
      /^[0-9]{10,11}$/,
      "Invalid phone number format (must be 10-11 digits)",
    )
    .optional(),
});

export const updatePasswordSchema = z.object({
  oldPassword: z.string().optional(),
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

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
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

export const resendVerificationSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

export const getAvatarUploadUrlSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"], {
    errorMap: () => ({
      message:
        "contentType must be one of: image/jpeg, image/png, image/webp, image/gif",
    }),
  }),
});

export const confirmAvatarUploadSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .regex(/^avatars\/[a-f0-9-]+\/\d+\.[a-z]+$/, "Invalid avatar key format"),
});

export const requestDeactivateSchema = z.object({
  password: z
    .string()
    .min(1, "Mật khẩu hiện tại là bắt buộc để xác nhận yêu cầu"),
  reason: z.string().max(500, "Lý do tối đa 500 ký tự").optional(),
});

export const confirmDeactivateSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "Mã xác nhận vô hiệu hóa không hợp lệ")
    .max(256, "Mã xác nhận vô hiệu hóa vượt quá độ dài tối đa"),
});

export const enable2FASchema = z.object({
  secret: z.string().min(16, "Secret key Base32 là bắt buộc"),
  code: z
    .string()
    .regex(/^\d{6}$/, "Mã xác thực TOTP phải bao gồm đúng 6 chữ số"),
});

export const verify2FALoginSchema = z.object({
  tempToken: z.string().min(1, "Token tạm thời (tempToken) là bắt buộc"),
  code: z
    .string()
    .min(6, "Mã xác nhận là bắt buộc")
    .max(20, "Mã xác nhận không hợp lệ"),
});

export const disable2FASchema = z.object({
  password: z
    .string()
    .min(1, "Mật khẩu hiện tại là bắt buộc để tắt 2FA")
    .optional(),
  code: z.string().min(6, "Mã TOTP hoặc mã dự phòng là bắt buộc").max(20),
});

export const regenerateBackupCodesSchema = z.object({
  password: z
    .string()
    .min(1, "Mật khẩu hiện tại là bắt buộc để tái tạo mã dự phòng")
    .optional(),
  code: z
    .string()
    .length(6, "Mã TOTP 6 chữ số từ ứng dụng xác thực là bắt buộc")
    .regex(/^\d{6}$/, "Mã TOTP phải là 6 chữ số"),
});

export const googleLoginSchema = z
  .object({
    idToken: z
      .string()
      .min(1, "Google ID Token không được để trống")
      .optional(),
    code: z
      .string()
      .min(1, "Authorization code không được để trống")
      .optional(),
    redirectUri: z
      .string()
      .url("Redirect URI không đúng định dạng URL")
      .optional(),
  })
  .refine(
    (data) =>
      (data.idToken && data.idToken.trim().length > 0) ||
      (data.code && data.code.trim().length > 0),
    {
      message:
        "Vui lòng cung cấp idToken (Google Sign-In) hoặc code (Authorization Code)",
      path: ["idToken"],
    },
  )
  .refine(
    (data) => {
      if (data.code) {
        return Boolean(data.redirectUri);
      }
      return true;
    },
    {
      message: "redirectUri là bắt buộc khi sử dụng authorization code",
      path: ["redirectUri"],
    },
  );

export const googleAuthUrlQuerySchema = z.object({
  redirectUri: z
    .string()
    .url("redirectUri không đúng định dạng URL")
    .optional(),
  state: z.string().max(255, "state tối đa 255 ký tự").optional(),
});

export const linkSocialAccountSchema = z
  .object({
    provider: z.enum(["GOOGLE", "ZALO"]).default("GOOGLE"),
    idToken: z
      .string()
      .min(1, "ID Token không được để trống")
      .optional(),
    code: z
      .string()
      .min(1, "Authorization code không được để trống")
      .optional(),
    redirectUri: z
      .string()
      .url("Redirect URI không đúng định dạng URL")
      .optional(),
  })
  .refine(
    (data) =>
      (data.idToken && data.idToken.trim().length > 0) ||
      (data.code && data.code.trim().length > 0),
    {
      message: "Vui lòng cung cấp idToken hoặc code",
      path: ["idToken"],
    },
  )
  .refine(
    (data) => {
      if (data.provider === "ZALO" && (!data.code || !data.code.trim())) {
        return false;
      }
      return true;
    },
    {
      message: "Zalo yêu cầu cung cấp authorization code",
      path: ["code"],
    },
  )
  .refine(
    (data) => {
      if (data.code) {
        return Boolean(data.redirectUri);
      }
      return true;
    },
    {
      message: "redirectUri là bắt buộc khi sử dụng authorization code",
      path: ["redirectUri"],
    },
  );

export const unlinkSocialAccountParamSchema = z.object({
  provider: z.enum(["GOOGLE", "ZALO"], {
    errorMap: () => ({ message: "Nhà cung cấp phải là GOOGLE hoặc ZALO" }),
  }),
});
