import { openapiRegistry } from "../../config/openapi/openapi.registry";
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  refreshSchema,
  logoutSchema,
  updateProfileSchema,
  updatePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  sessionIdParamSchema,
  getAvatarUploadUrlSchema,
  confirmAvatarUploadSchema,
  revokeOtherSessionsSchema,
  requestDeactivateSchema,
  confirmDeactivateSchema,
  enable2FASchema,
  verify2FALoginSchema,
  disable2FASchema,
  regenerateBackupCodesSchema,
  googleLoginSchema,
  googleAuthUrlQuerySchema,
  linkSocialAccountSchema,
  unlinkSocialAccountParamSchema,
} from "./auth.validation";
import { z } from "zod";

export function registerAuthOpenApi(): void {
  // ── Schemas ──────────────────────────────────────────────────────────────────
  openapiRegistry.register("LoginRequest", loginSchema);
  openapiRegistry.register("RegisterRequest", registerSchema);
  openapiRegistry.register("UpdateProfileRequest", updateProfileSchema);
  openapiRegistry.register("UpdatePasswordRequest", updatePasswordSchema);
  openapiRegistry.register("ForgotPasswordRequest", forgotPasswordSchema);
  openapiRegistry.register("ResetPasswordRequest", resetPasswordSchema);
  openapiRegistry.register(
    "ResendVerificationRequest",
    resendVerificationSchema,
  );
  openapiRegistry.register(
    "GetAvatarUploadUrlRequest",
    getAvatarUploadUrlSchema,
  );
  openapiRegistry.register(
    "ConfirmAvatarUploadRequest",
    confirmAvatarUploadSchema,
  );
  openapiRegistry.register("RequestDeactivateRequest", requestDeactivateSchema);
  openapiRegistry.register("ConfirmDeactivateRequest", confirmDeactivateSchema);
  openapiRegistry.register("Enable2FARequest", enable2FASchema);
  openapiRegistry.register("Verify2FALoginRequest", verify2FALoginSchema);
  openapiRegistry.register("Disable2FARequest", disable2FASchema);
  openapiRegistry.register(
    "RegenerateBackupCodesRequest",
    regenerateBackupCodesSchema,
  );
  openapiRegistry.register("GoogleLoginRequest", googleLoginSchema);
  openapiRegistry.register("LinkSocialAccountRequest", linkSocialAccountSchema);

  // ── Routes ───────────────────────────────────────────────────────────────────

  // POST /auth/register
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/register",
    tags: ["Auth", "Authentication"],
    summary: "Đăng ký tài khoản người dùng mới",
    request: {
      body: {
        content: {
          "application/json": { schema: registerSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Đăng ký thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example:
                  "Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác thực.",
              }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                isEmailVerified: z.boolean(),
              }),
            }),
          },
        },
      },
      400: { description: "Dữ liệu không hợp lệ / Email đã tồn tại" },
    },
  });

  // GET /auth/verify-email
  openapiRegistry.registerPath({
    method: "get",
    path: "/auth/verify-email",
    tags: ["Auth", "Authentication"],
    summary: "Xác thực email qua token",
    request: {
      query: verifyEmailSchema,
    },
    responses: {
      200: {
        description: "Xác thực email thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Email đã được xác thực thành công." }),
            }),
          },
        },
      },
      400: { description: "Token không hợp lệ hoặc đã hết hạn" },
    },
  });

  // POST /auth/login
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/login",
    tags: ["Auth", "Authentication"],
    summary: "Đăng nhập người dùng",
    request: {
      body: {
        content: {
          "application/json": { schema: loginSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Đăng nhập thành công hoặc yêu cầu thử thách 2FA",
        content: {
          "application/json": {
            schema: z.union([
              z.object({
                success: z.boolean().openapi({ example: true }),
                data: z.object({
                  accessToken: z.string(),
                  refreshToken: z.string(),
                  user: z.object({
                    id: z.string().uuid(),
                    email: z.string().email(),
                    fullName: z.string().nullable(),
                    role: z.string(),
                    permissions: z.array(z.string()),
                  }),
                }),
              }),
              z.object({
                success: z.boolean().openapi({ example: true }),
                data: z.object({
                  requires2FA: z.literal(true).openapi({ example: true }),
                  tempToken: z.string().openapi({
                    description:
                      "Token tạm thời dùng để gọi endpoint POST /auth/2fa/verify",
                    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                  }),
                }),
              }),
            ]),
          },
        },
      },
      401: { description: "Email hoặc mật khẩu không chính xác" },
      429: { description: "Quá nhiều yêu cầu đăng nhập, vui lòng thử lại sau" },
    },
  });

  // GET /auth/me
  openapiRegistry.registerPath({
    method: "get",
    path: "/auth/me",
    tags: ["Auth", "Authentication"],
    summary: "Lấy thông tin tài khoản hiện tại",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Lấy thông tin thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                avatarUrl: z.string().nullable(),
                phoneNumber: z.string().nullable(),
                role: z.string(),
                permissions: z.array(z.string()),
              }),
            }),
          },
        },
      },
      401: { description: "Chưa xác thực" },
    },
  });

  // POST /auth/refresh
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/refresh",
    tags: ["Auth", "Authentication"],
    summary: "Làm mới Access Token bằng Refresh Token",
    request: {
      body: {
        content: {
          "application/json": { schema: refreshSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Làm mới token thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                accessToken: z.string(),
                refreshToken: z.string(),
                permissions: z.array(z.string()),
              }),
            }),
          },
        },
      },
      401: { description: "Refresh token không hợp lệ hoặc đã hết hạn" },
    },
  });

  // POST /auth/logout
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/logout",
    tags: ["Auth", "Authentication"],
    summary: "Đăng xuất tài khoản",
    request: {
      body: {
        content: {
          "application/json": { schema: logoutSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Đăng xuất thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({ example: "Đăng xuất thành công" }),
            }),
          },
        },
      },
    },
  });

  // PUT /auth/profile
  openapiRegistry.registerPath({
    method: "put",
    path: "/auth/profile",
    tags: ["Auth", "Authentication"],
    summary: "Cập nhật thông tin cá nhân",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: updateProfileSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                fullName: z.string().nullable(),
                avatarUrl: z.string().nullable(),
                phoneNumber: z.string().nullable(),
              }),
            }),
          },
        },
      },
      401: { description: "Chưa xác thực" },
    },
  });

  // PUT /auth/password
  openapiRegistry.registerPath({
    method: "put",
    path: "/auth/password",
    tags: ["Auth", "Authentication"],
    summary: "Đổi mật khẩu tài khoản",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: updatePasswordSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Đổi mật khẩu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Đổi mật khẩu thành công" }),
            }),
          },
        },
      },
      400: { description: "Mật khẩu cũ không chính xác" },
      401: { description: "Chưa xác thực" },
    },
  });

  // POST /auth/forgot-password
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/forgot-password",
    tags: ["Auth", "Authentication"],
    summary: "Yêu cầu gửi email khôi phục mật khẩu",
    request: {
      body: {
        content: {
          "application/json": { schema: forgotPasswordSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Gửi yêu cầu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example:
                  "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.",
              }),
            }),
          },
        },
      },
    },
  });

  // POST /auth/reset-password
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/reset-password",
    tags: ["Auth", "Authentication"],
    summary: "Đặt lại mật khẩu qua reset token",
    request: {
      body: {
        content: {
          "application/json": { schema: resetPasswordSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Đặt lại mật khẩu thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Mật khẩu đã được đặt lại thành công." }),
            }),
          },
        },
      },
      400: { description: "Token không hợp lệ hoặc đã hết hạn" },
    },
  });

  // POST /auth/resend-verification
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/resend-verification",
    tags: ["Auth", "Authentication"],
    summary: "Gửi lại email xác thực tài khoản",
    request: {
      body: {
        content: {
          "application/json": { schema: resendVerificationSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Gửi lại email thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example:
                  "Nếu email tồn tại và chưa xác thực, email kích hoạt đã được gửi lại.",
              }),
            }),
          },
        },
      },
      429: {
        description: "Quá nhiều yêu cầu, vui lòng đợi 60 giây trước khi gửi lại",
      },
    },
  });

  // GET /auth/sessions
  openapiRegistry.registerPath({
    method: "get",
    path: "/auth/sessions",
    tags: ["Auth", "Authentication"],
    summary: "Danh sách các phiên đăng nhập hoạt động",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Lấy danh sách phiên thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  userAgent: z.string().nullable(),
                  ipAddress: z.string().nullable(),
                  createdAt: z.string().datetime(),
                  expiresAt: z.string().datetime(),
                  isCurrent: z.boolean(),
                }),
              ),
            }),
          },
        },
      },
    },
  });

  // DELETE /auth/sessions/:id
  openapiRegistry.registerPath({
    method: "delete",
    path: "/auth/sessions/{id}",
    tags: ["Auth", "Authentication"],
    summary: "Thu hồi một phiên đăng nhập cụ thể",
    security: [{ BearerAuth: [] }],
    request: {
      params: sessionIdParamSchema,
    },
    responses: {
      200: {
        description: "Thu hồi phiên thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Thu hồi phiên đăng nhập thành công" }),
            }),
          },
        },
      },
    },
  });

  // DELETE /auth/sessions
  openapiRegistry.registerPath({
    method: "delete",
    path: "/auth/sessions",
    tags: ["Auth", "Authentication"],
    summary: "Thu hồi toàn bộ các phiên đăng nhập khác",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: revokeOtherSessionsSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Thu hồi các phiên khác thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example: "Đã thu hồi tất cả các phiên đăng nhập khác",
              }),
            }),
          },
        },
      },
    },
  });

  // POST /auth/avatar/upload-url
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/avatar/upload-url",
    tags: ["Auth", "Authentication"],
    summary: "Lấy Presigned URL tải lên Avatar lên Cloudflare R2 / S3",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: getAvatarUploadUrlSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Tạo upload URL thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                uploadUrl: z.string().url(),
                key: z.string(),
              }),
            }),
          },
        },
      },
    },
  });

  // POST /auth/avatar/confirm
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/avatar/confirm",
    tags: ["Auth", "Authentication"],
    summary: "Xác nhận hoàn tất tải lên Avatar",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: confirmAvatarUploadSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Cập nhật avatar thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                avatarUrl: z.string().url(),
              }),
            }),
          },
        },
      },
    },
  });

  // POST /auth/deactivate/request
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/deactivate/request",
    tags: ["Auth", "Authentication"],
    summary:
      "Yêu cầu vô hiệu hóa tài khoản (gửi email xác nhận kèm token 15 phút)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: requestDeactivateSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Yêu cầu vô hiệu hóa đã được tiếp nhận",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example:
                  "Yêu cầu vô hiệu hóa tài khoản đã được tiếp nhận. Vui lòng kiểm tra email để xác nhận (hạn 15 phút).",
              }),
            }),
          },
        },
      },
      400: {
        description:
          "Mật khẩu hiện tại không chính xác hoặc dữ liệu không hợp lệ",
      },
      401: { description: "Chưa đăng nhập" },
      403: {
        description:
          "Không thể vô hiệu hóa tài khoản Admin duy nhất của hệ thống",
      },
    },
  });

  // POST /auth/deactivate/confirm
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/deactivate/confirm",
    tags: ["Auth", "Authentication"],
    summary: "Xác nhận vô hiệu hóa tài khoản bằng mã token nhận qua email",
    request: {
      body: {
        content: {
          "application/json": { schema: confirmDeactivateSchema },
        },
      },
    },
    responses: {
      200: {
        description:
          "Vô hiệu hóa tài khoản thành công và toàn bộ phiên đăng nhập đã bị hủy",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example:
                  "Tài khoản của bạn đã được vô hiệu hóa thành công. Toàn bộ phiên đăng nhập đã bị hủy.",
              }),
            }),
          },
        },
      },
      400: {
        description: "Mã xác nhận vô hiệu hóa không hợp lệ hoặc đã hết hạn",
      },
      403: {
        description:
          "Không thể vô hiệu hóa tài khoản Admin duy nhất của hệ thống",
      },
    },
  });

  // ── 2FA Routes ─────────────────────────────────────────────────────────────

  // POST /auth/2fa/setup
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/2fa/setup",
    tags: ["Auth - 2FA"],
    summary: "Khởi tạo thiết lập 2FA (sinh khóa Base32 và URI quét mã QR)",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Khởi tạo thành công, trả về secret và otpauthUrl",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                secret: z.string().openapi({ example: "JBSWY3DPEHPK3PXP..." }),
                otpauthUrl: z.string().openapi({
                  example:
                    "otpauth://totp/TemplateBE:user@example.com?secret=...",
                }),
              }),
            }),
          },
        },
      },
      400: { description: "2FA đã được kích hoạt trước đó" },
      401: { description: "Chưa đăng nhập" },
    },
  });

  // POST /auth/2fa/enable
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/2fa/enable",
    tags: ["Auth - 2FA"],
    summary:
      "Xác nhận mã 6 số và chính thức kích hoạt 2FA (trả về 8 mã dự phòng)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: enable2FASchema },
        },
      },
    },
    responses: {
      200: {
        description: "Kích hoạt 2FA thành công, trả về danh sách backup codes",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example: "Kích hoạt xác thực 2 bước (2FA) thành công",
              }),
              data: z.object({
                backupCodes: z
                  .array(z.string())
                  .openapi({ example: ["A1B2-C3D4", "E5F6-G7H8"] }),
              }),
            }),
          },
        },
      },
      400: {
        description:
          "Mã TOTP không chính xác hoặc 2FA đã được kích hoạt trước đó",
      },
      401: { description: "Chưa đăng nhập" },
    },
  });

  // POST /auth/2fa/verify
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/2fa/verify",
    tags: ["Auth - 2FA"],
    summary:
      "Xác thực thử thách 2FA khi đăng nhập bằng mã TOTP 6 số hoặc mã dự phòng",
    request: {
      body: {
        content: {
          "application/json": { schema: verify2FALoginSchema },
        },
      },
    },
    responses: {
      200: {
        description:
          "Xác thực thành công, cấp Access Token và Refresh Token chính thức",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                accessToken: z.string(),
                refreshToken: z.string(),
                user: z.object({
                  id: z.string().uuid(),
                  email: z.string().email().nullable(),
                  fullName: z.string().nullable(),
                  role: z.string(),
                  roleId: z.string().uuid(),
                  permissions: z.array(z.string()),
                }),
              }),
            }),
          },
        },
      },
      400: { description: "Mã xác thực hoặc mã dự phòng không chính xác" },
      401: {
        description: "Token tạm thời (tempToken) không hợp lệ hoặc đã hết hạn",
      },
    },
  });

  // POST /auth/2fa/disable
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/2fa/disable",
    tags: ["Auth - 2FA"],
    summary: "Tắt 2FA (yêu cầu mật khẩu hiện tại + mã TOTP hoặc mã dự phòng)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: disable2FASchema },
        },
      },
    },
    responses: {
      200: {
        description: "Tắt 2FA thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example: "Đã tắt xác thực 2 bước (2FA) thành công",
              }),
            }),
          },
        },
      },
      400: { description: "Mật khẩu hoặc mã 2FA không chính xác" },
      401: { description: "Chưa đăng nhập" },
    },
  });

  // POST /auth/2fa/backup-codes/regenerate
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/2fa/backup-codes/regenerate",
    tags: ["Auth - 2FA"],
    summary: "Tái tạo danh sách mã dự phòng 2FA (hủy toàn bộ mã cũ)",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: regenerateBackupCodesSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Tái tạo mã dự phòng thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Tái tạo mã dự phòng 2FA thành công" }),
              data: z.object({
                backupCodes: z
                  .array(z.string())
                  .openapi({ example: ["X1Y2-Z3A4", "B5C6-D7E8"] }),
              }),
            }),
          },
        },
      },
      400: { description: "Mật khẩu hoặc mã 2FA không chính xác" },
      401: { description: "Chưa đăng nhập" },
    },
  });

  // GET /auth/google/url
  openapiRegistry.registerPath({
    method: "get",
    path: "/auth/google/url",
    tags: ["Auth - Social"],
    summary: "Lấy URL đăng nhập Google OAuth2",
    request: {
      query: googleAuthUrlQuerySchema,
    },
    responses: {
      200: {
        description: "Tạo URL ủy quyền Google thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.object({
                url: z.string().openapi({
                  example:
                    "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=openid+email+profile&access_type=offline&prompt=consent",
                }),
              }),
            }),
          },
        },
      },
      500: { description: "Google OAuth2 chưa được cấu hình trên máy chủ" },
    },
  });

  // POST /auth/google
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/google",
    tags: ["Auth - Social"],
    summary:
      "Đăng nhập hoặc liên kết tài khoản bằng Google OAuth2 (ID Token hoặc Authorization Code)",
    request: {
      body: {
        content: {
          "application/json": { schema: googleLoginSchema },
        },
      },
    },
    responses: {
      200: {
        description:
          "Đăng nhập thành công hoặc trả về thử thách 2FA nếu tài khoản đã kích hoạt 2FA",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.union([
                z.object({
                  accessToken: z
                    .string()
                    .openapi({ example: "eyJhbGciOiJIUzI1Ni..." }),
                  refreshToken: z
                    .string()
                    .openapi({ example: "eyJhbGciOiJIUzI1Ni..." }),
                  user: z.object({
                    id: z.string().uuid(),
                    email: z.string().email(),
                    fullName: z.string().nullable(),
                    role: z.string(),
                    roleId: z.string().uuid(),
                    permissions: z.array(z.string()),
                  }),
                }),
                z.object({
                  requires2FA: z.boolean().openapi({ example: true }),
                  tempToken: z
                    .string()
                    .openapi({ example: "eyJhbGciOiJIUzI1Ni..." }),
                }),
              ]),
            }),
          },
        },
      },
      400: {
        description:
          "Dữ liệu đầu vào không hợp lệ hoặc email Google chưa xác thực",
      },
      401: {
        description: "Xác thực Google ID Token thất bại hoặc token hết hạn",
      },
      403: { description: "Tài khoản đã bị vô hiệu hóa hoặc xóa" },
    },
  });

  // GET /auth/social
  openapiRegistry.registerPath({
    method: "get",
    path: "/auth/social",
    tags: ["Auth - Social"],
    summary:
      "Lấy danh sách các tài khoản mạng xã hội đã liên kết của người dùng",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Danh sách tài khoản mạng xã hội đã liên kết",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              data: z.array(
                z.object({
                  id: z.string().uuid(),
                  provider: z.string().openapi({ example: "GOOGLE" }),
                  providerUserId: z.string().openapi({ example: "1092837465" }),
                  createdAt: z.date(),
                }),
              ),
            }),
          },
        },
      },
      401: { description: "Chưa đăng nhập" },
    },
  });

  // POST /auth/social/link
  openapiRegistry.registerPath({
    method: "post",
    path: "/auth/social/link",
    tags: ["Auth - Social"],
    summary:
      "Chủ động liên kết tài khoản mạng xã hội (Google) trong trang cá nhân",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: linkSocialAccountSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Liên kết tài khoản mạng xã hội thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z
                .string()
                .openapi({ example: "Liên kết tài khoản Google thành công" }),
              data: z.object({
                provider: z.string().openapi({ example: "GOOGLE" }),
                email: z.string().email().optional(),
              }),
            }),
          },
        },
      },
      400: {
        description:
          "Dữ liệu không hợp lệ hoặc tài khoản đã liên kết với Google",
      },
      401: { description: "Chưa đăng nhập hoặc Google token không hợp lệ" },
      409: {
        description:
          "Tài khoản Google này đã được liên kết với người dùng khác",
      },
    },
  });

  // DELETE /auth/social/{provider}
  openapiRegistry.registerPath({
    method: "delete",
    path: "/auth/social/{provider}",
    tags: ["Auth - Social"],
    summary:
      "Hủy liên kết tài khoản mạng xã hội (bảo vệ chống tự khóa tài khoản)",
    security: [{ BearerAuth: [] }],
    request: {
      params: unlinkSocialAccountParamSchema,
    },
    responses: {
      200: {
        description: "Hủy liên kết tài khoản mạng xã hội thành công",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean().openapi({ example: true }),
              message: z.string().openapi({
                example: "Đã hủy liên kết tài khoản GOOGLE thành công",
              }),
            }),
          },
        },
      },
      400: {
        description:
          "Tài khoản chưa liên kết hoặc không thể hủy phương thức đăng nhập duy nhất khi chưa có mật khẩu",
      },
      401: { description: "Chưa đăng nhập" },
    },
  });
}
