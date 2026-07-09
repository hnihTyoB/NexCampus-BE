import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, ForgotPasswordDto, ResetPasswordDto } from "./auth.dto";

export class AuthController {
  private readonly service = new AuthService();

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LoginDto;
      const userAgent = req.headers["user-agent"];
      const ipAddress = req.ip;
      const result = await this.service.login(body, { userAgent, ipAddress });

      res.json({
        success: true,
        data: result,
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
      const { refreshToken } = req.body;
      const userAgent = req.headers["user-agent"];
      const ipAddress = req.ip;
      const result = await this.service.refresh(refreshToken, {
        userAgent,
        ipAddress,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      await this.service.logout(refreshToken, req.user.id);

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
}
