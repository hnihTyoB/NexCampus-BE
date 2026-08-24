import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authRateLimitMiddleware } from '../../middlewares/rate-limit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  revokeOtherSessionsSchema,
  registerSchema,
  verifyEmailSchema,
  updateProfileSchema,
  updatePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  sessionIdParamSchema,
  getAvatarUploadUrlSchema,
  confirmAvatarUploadSchema,
} from './auth.validation';

const router = Router();
const controller = new AuthController();

router.post('/register', authRateLimitMiddleware, validate(registerSchema), controller.register);
router.get('/verify-email', validate(verifyEmailSchema, 'query'), controller.verifyEmail);
router.post('/login', authRateLimitMiddleware, validate(loginSchema), controller.login);
router.get('/me', authMiddleware, controller.me);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', validate(logoutSchema), controller.logout);
router.put('/profile', authMiddleware, validate(updateProfileSchema), controller.updateProfile);
router.put('/password', authMiddleware, validate(updatePasswordSchema), controller.updatePassword);
router.post('/forgot-password', authRateLimitMiddleware, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', authRateLimitMiddleware, validate(resetPasswordSchema), controller.resetPassword);
router.post('/resend-verification', authRateLimitMiddleware, validate(resendVerificationSchema), controller.resendVerification);

router.get('/sessions', authMiddleware, controller.getSessions);
router.delete('/sessions/:id', authMiddleware, validate(sessionIdParamSchema, 'params'), controller.revokeSession);
router.delete('/sessions', authMiddleware, validate(revokeOtherSessionsSchema), controller.revokeOtherSessions);


router.post('/avatar/upload-url', authMiddleware, validate(getAvatarUploadUrlSchema), controller.getAvatarUploadUrl);
router.post('/avatar/confirm', authMiddleware, validate(confirmAvatarUploadSchema), controller.confirmAvatarUpload);

export default router;
