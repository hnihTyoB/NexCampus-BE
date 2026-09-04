import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

export interface GoogleUserProfile {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  fullName?: string;
  avatarUrl?: string;
}

export interface GoogleTokenResponse {
  idToken: string;
  accessToken?: string;
}

/**
 * Xác thực Google ID Token thông qua endpoint chính thức của Google.
 * Sử dụng native fetch (Zero third-party dependencies).
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId?: string,
): Promise<GoogleUserProfile> {
  if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
    throw new AppError(
      "Google ID Token là bắt buộc",
      400,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }

  const endpoint = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err: any) {
    const isTimeout = err.name === "TimeoutError" || err.code === "ABORT_ERR";
    throw new AppError(
      isTimeout
        ? "Kết nối đến máy chủ xác thực Google bị quá thời gian chờ (timeout 10s)"
        : `Không thể kết nối đến máy chủ xác thực Google: ${err.message || "Lỗi mạng"}`,
      502,
      ERROR_CODE.INTERNAL_SERVER_ERROR,
    );
  }

  if (!response.ok) {
    throw new AppError(
      "Google ID Token không hợp lệ hoặc đã hết hạn",
      401,
      ERROR_CODE.GOOGLE_AUTH_FAILED,
    );
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new AppError(
      "Dữ liệu phản hồi từ Google không hợp lệ",
      502,
      ERROR_CODE.GOOGLE_AUTH_FAILED,
    );
  }

  // 1. Kiểm tra Issuer
  const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
  if (!payload.iss || !validIssuers.includes(payload.iss)) {
    throw new AppError(
      "Google ID Token có nguồn phát hành (iss) không hợp lệ",
      401,
      ERROR_CODE.GOOGLE_AUTH_FAILED,
    );
  }

  // 2. Kiểm tra Audience nếu hệ thống có thiết lập GOOGLE_CLIENT_ID
  if (expectedClientId && expectedClientId.trim()) {
    if (payload.aud !== expectedClientId.trim()) {
      throw new AppError(
        "Google ID Token (aud) không khớp với Client ID của ứng dụng",
        401,
        ERROR_CODE.GOOGLE_AUTH_FAILED,
      );
    }
  }

  // 3. Kiểm tra hạn dùng
  if (!payload.exp || Number(payload.exp) * 1000 <= Date.now()) {
    throw new AppError(
      "Google ID Token đã hết hạn",
      401,
      ERROR_CODE.GOOGLE_AUTH_FAILED,
    );
  }

  // 4. Kiểm tra Subject (Google User ID)
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new AppError(
      "Google ID Token thiếu thông tin định danh người dùng (sub)",
      401,
      ERROR_CODE.GOOGLE_AUTH_FAILED,
    );
  }

  // 5. Kiểm tra Email
  if (!payload.email || typeof payload.email !== "string") {
    throw new AppError(
      "Google ID Token không chứa địa chỉ email",
      400,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }

  // 6. Kiểm tra Email đã được Google xác thực
  const isEmailVerified =
    payload.email_verified === true || payload.email_verified === "true";
  if (!isEmailVerified) {
    throw new AppError(
      "Địa chỉ email Google chưa được xác thực",
      400,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }

  return {
    providerUserId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    emailVerified: true,
    fullName: payload.name || undefined,
    avatarUrl: payload.picture || undefined,
  };
}

/**
 * Trao đổi Authorization Code lấy Google ID Token và Access Token.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokenResponse> {
  if (!code || !code.trim()) {
    throw new AppError(
      "Authorization code là bắt buộc",
      400,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }
  if (!redirectUri || !redirectUri.trim()) {
    throw new AppError(
      "Redirect URI là bắt buộc khi sử dụng authorization code",
      400,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }
  if (!clientId || !clientSecret) {
    throw new AppError(
      "Google Client ID hoặc Client Secret chưa được cấu hình",
      500,
      ERROR_CODE.CONFIGURATION_ERROR,
    );
  }

  const endpoint = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    code: code.trim(),
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    redirect_uri: redirectUri.trim(),
    grant_type: "authorization_code",
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err: any) {
    const isTimeout = err.name === "TimeoutError" || err.code === "ABORT_ERR";
    throw new AppError(
      isTimeout
        ? "Kết nối đến máy chủ token của Google bị quá thời gian chờ (timeout 10s)"
        : `Không thể kết nối đến máy chủ token của Google: ${err.message || "Lỗi mạng"}`,
      502,
      ERROR_CODE.INTERNAL_SERVER_ERROR,
    );
  }

  if (!response.ok) {
    throw new AppError(
      "Không thể đổi authorization code lấy token từ Google",
      400,
      ERROR_CODE.GOOGLE_AUTH_FAILED,
    );
  }

  const data: any = await response.json();
  if (!data.id_token) {
    throw new AppError(
      "Google không trả về ID Token sau khi đổi code",
      502,
      ERROR_CODE.GOOGLE_AUTH_FAILED,
    );
  }

  return {
    idToken: data.id_token,
    accessToken: data.access_token,
  };
}

/**
 * Tạo URL ủy quyền Google OAuth2 để chuyển hướng người dùng đăng nhập.
 */
export function generateGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state?: string,
): string {
  if (!clientId || !clientId.trim()) {
    throw new AppError(
      "Google Client ID chưa được cấu hình",
      500,
      ERROR_CODE.CONFIGURATION_ERROR,
    );
  }

  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  if (state && state.trim()) {
    params.set("state", state.trim());
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
