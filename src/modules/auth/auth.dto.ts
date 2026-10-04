export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface MeDto {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  phoneNumber: string | null;
  discordUserId?: string | null;
  discordUsername?: string | null;
  role: string;
  roleId: string;
  portalType?: "ADMIN" | "LEADER" | "INTERN" | string;
  permissions: string[];
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

export interface LoginResponseDto {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string | null;
    fullName: string | null;
    role: string;
    roleId: string;
    portalType?: "ADMIN" | "LEADER" | "INTERN" | string;
    permissions: string[];
  };
  requires2FA?: boolean;
  tempToken?: string;
}

export interface UpdateProfileDto {
  fullName?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  discordUserId?: string | null;
  discordUsername?: string | null;
}

export interface UpdatePasswordDto {
  oldPassword?: string;
  newPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ResendVerificationDto {
  email: string;
}

export interface GetAvatarUploadUrlDto {
  contentType: string;
  mimeType?: string;
}

export interface GetAvatarUploadUrlResponseDto {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  filePath: string;
  expiresIn: number;
}

export interface ConfirmAvatarUploadDto {
  key: string;
  filePath?: string;
}

export interface RequestDeactivateDto {
  password: string;
  reason?: string;
}

export interface ConfirmDeactivateDto {
  token: string;
}

export interface Setup2FAResponseDto {
  secret: string;
  otpauthUrl: string;
}

export interface Enable2FADto {
  secret: string;
  code: string;
}

export interface Enable2FAResponseDto {
  backupCodes: string[];
}

export interface Verify2FALoginDto {
  tempToken: string;
  code: string;
}

export interface Disable2FADto {
  password?: string;
  code: string;
}

export interface RegenerateBackupCodesDto {
  password?: string;
  code: string;
}

export interface GoogleLoginDto {
  idToken?: string;
  code?: string;
  redirectUri?: string;
}

export interface GoogleAuthUrlQueryDto {
  redirectUri?: string;
  state?: string;
}

export interface GoogleAuthUrlResponseDto {
  url: string;
}

export interface LinkSocialAccountDto {
  provider?: "GOOGLE" | "ZALO";
  idToken?: string;
  code?: string;
  redirectUri?: string;
}

export interface SocialAccountDto {
  id: string;
  provider: string;
  providerUserId: string;
  createdAt: Date;
}

export interface UnlinkSocialAccountParamDto {
  provider: "GOOGLE" | "ZALO";
}
