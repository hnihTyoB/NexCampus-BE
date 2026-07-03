import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';

export class AuthController {
  private readonly service = new AuthService();

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LoginDto;
      const userAgent = req.headers['user-agent'];
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

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip;
      const result = await this.service.refresh(refreshToken, { userAgent, ipAddress });

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
      await this.service.logout(refreshToken);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
