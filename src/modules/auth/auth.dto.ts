export interface LoginDto {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface MeInternDto {
  id: string;
  phone: string;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  startDate: Date;
  duration: number;
  discordUsername: string | null;
  discordRoleGranted: boolean;
  status: string;
}

export interface MeNotificationSettingDto {
  id: string;
  webEnabled: boolean;
  emailEnabled: boolean;
  discordEnabled: boolean;
}

export interface MeDto {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  intern: MeInternDto | null;
  notificationSetting: MeNotificationSettingDto | null;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface ChangePasswordDto {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

