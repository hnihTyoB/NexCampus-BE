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
  role: string;
  roleId: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    role: string;
    roleId: string;
    permissions: string[];
  };
}

export interface UpdateProfileDto {
  fullName?: string;
  avatarUrl?: string;
  phoneNumber?: string;
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
}

export interface GetAvatarUploadUrlResponseDto {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

export interface ConfirmAvatarUploadDto {
  key: string;
}
