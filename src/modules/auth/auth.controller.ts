import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from "./auth.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { envConfig } from "../../config/env.config";
import { jwtConfig } from "../../config/jwt.config";

export class AuthController {
  private readonly service = new AuthService();

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LoginDto;
      const userAgent = req.headers["user-agent"];
      const ipAddress = req.ip;
      const result = await this.service.login(body, { userAgent, ipAddress });

      const isProduction = envConfig.nodeEnv === "production";

      // rememberMe=true  → persistent cookie (survives browser restart)
      // rememberMe=false → session cookie (cleared when browser closes)
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        ...(body.rememberMe ? { maxAge: jwtConfig.refreshExpiresInMs } : {}),
      });

      // Never expose refreshToken in the response body - cookie handles it
      const { refreshToken: _rt, ...publicData } = result;
      res.json({
        success: true,
        data: publicData,
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

  updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fullName, password, avatarUrl } = req.body;
      const result = await this.service.updateMe(req.user.id, {
        fullName,
        password,
        avatarUrl,
      });

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
      // Refresh token comes exclusively from the HTTP-only cookie
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        throw new AppError(
          "Refresh token is required",
          400,
          ERROR_CODE.TOKEN_INVALID,
        );
      }
      const userAgent = req.headers["user-agent"];
      const ipAddress = req.ip;
      const result = await this.service.refresh(refreshToken, {
        userAgent,
        ipAddress,
      });

      const isProduction = envConfig.nodeEnv === "production";

      // Preserve the original rememberMe preference encoded in the JWT payload
      const decoded = result.rememberMe;
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        ...(decoded ? { maxAge: jwtConfig.refreshExpiresInMs } : {}),
      });

      res.json({
        success: true,
        data: { accessToken: result.accessToken },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Refresh token comes exclusively from the HTTP-only cookie
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        throw new AppError(
          "Refresh token is required",
          400,
          ERROR_CODE.TOKEN_INVALID,
        );
      }
      await this.service.logout(refreshToken, req.user.id);

      const isProduction = envConfig.nodeEnv === "production";
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
      });

      res.json({
        success: true,
        message: "Logged out successfully",
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
        message: "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi.",
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
        message: "Đặt lại mật khẩu thành công.",
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ChangePasswordDto;
      const userId = req.user.id;
      await this.service.changePassword(userId, body);

      res.json({
        success: true,
        message: "Thay đổi mật khẩu thành công.",
      });
    } catch (error) {
      next(error);
    }
  };
}
