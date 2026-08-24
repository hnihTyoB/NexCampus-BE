import { z } from 'zod';
import { isPublicHttpUrl } from '../../common/helpers/url.helper';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
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
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  fullName: z.string().optional(),
});

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session ID format'),
});

export const verifyEmailSchema = z.object({
  token: z.string().uuid('Invalid verification token format'),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name cannot be empty').optional(),
  avatarUrl: z
    .string()
    .refine(
      (url) => url === '' || isPublicHttpUrl(url),
      'avatarUrl must be a valid public HTTPS URL (private IP and localhost are not allowed in production)',
    )
    .optional(),
  phoneNumber: z.string().regex(/^[0-9]{10,11}$/, 'Invalid phone number format (must be 10-11 digits)').optional(),
});

export const updatePasswordSchema = z.object({
  oldPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
});

export const resendVerificationSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

export const getAvatarUploadUrlSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif'], {
    errorMap: () => ({ message: 'contentType must be one of: image/jpeg, image/png, image/webp, image/gif' }),
  }),
});

export const confirmAvatarUploadSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .regex(/^avatars\/[a-f0-9-]+\/\d+\.[a-z]+$/, 'Invalid avatar key format'),
});
