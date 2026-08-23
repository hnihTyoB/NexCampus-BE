import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, UpdateProfileDto, UpdatePasswordDto, ForgotPasswordDto, ResetPasswordDto, ResendVerificationDto, GetAvatarUploadUrlDto, ConfirmAvatarUploadDto } from './auth.dto';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';

export class AuthController {
  private readonly service = new AuthService();

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LoginDto;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip;
      const result = await this.service.login(body, { userAgent, ipAddress });

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMe(req.user.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400, ERROR_CODE.TOKEN_INVALID);
      }

      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip;
      const result = await this.service.refresh(refreshToken, { userAgent, ipAddress });

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      if (refreshToken) {
        await this.service.logout(refreshToken);
      }

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
      };
      res.clearCookie('accessToken', cookieOptions);
      res.clearCookie('refreshToken', cookieOptions);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as RegisterDto;
      await this.service.register(body);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as { token: string };
      await this.service.verifyEmail(token);

      res.json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateProfileDto;
      await this.service.updateProfile(req.user.id, body);

      res.json({
        success: true,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  updatePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdatePasswordDto;
      await this.service.updatePassword(req.user.id, body);

      res.json({
        success: true,
        message: 'Password updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ForgotPasswordDto;
      await this.service.forgotPassword(body);

      res.json({
        success: true,
        message: 'Password reset link sent to your email',
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ResetPasswordDto;
      await this.service.resetPassword(body);

      res.json({
        success: true,
        message: 'Password has been reset successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  resendVerification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ResendVerificationDto;
      await this.service.resendVerification(body);

      res.json({
        success: true,
        message: 'Verification email sent successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentToken = req.cookies?.refreshToken || req.body.refreshToken;
      const result = await this.service.getActiveSessions(req.user.id, currentToken);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.service.revokeSession(req.user.id, id);
      res.json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  revokeOtherSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentToken = req.cookies?.refreshToken || req.body.refreshToken;
      if (!currentToken) {
        throw new AppError('Current session token is required', 400, ERROR_CODE.TOKEN_INVALID);
      }
      await this.service.revokeAllOtherSessions(req.user.id, currentToken);
      res.json({
        success: true,
        message: 'All other sessions revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bước 1: Trả về presigned PUT URL để client upload avatar trực tiếp lên R2.
   * Client phải tự crop ảnh trước khi PUT lên uploadUrl.
   */
  getAvatarUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as GetAvatarUploadUrlDto;
      const result = await this.service.getAvatarUploadUrl(req.user.id, body);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bước 2: Xác nhận client đã upload xong và lưu URL avatar mới vào DB.
   */
  confirmAvatarUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ConfirmAvatarUploadDto;
      const avatarUrl = await this.service.confirmAvatarUpload(req.user.id, body);

      res.json({
        success: true,
        data: { avatarUrl },
      });
    } catch (error) {
      next(error);
    }
  };
}
