import { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service";
import { UserQueryDto, CreateUserDto, UpdateUserDto } from "./user.dto";

export class UserController {
  private readonly service = new UserService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as UserQueryDto;
      const result = await this.service.findAll(query);

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateUserDto;
      const result = await this.service.create(body);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateUserDto;
      const result = await this.service.update(req.params.id, body);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  softDelete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      await this.service.softDelete(id, adminId);

      res.json({
        success: true,
        message: "User soft-deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  // ────── Session Management ──────

  getUserSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getUserSessions(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  revokeUserSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await this.service.revokeUserSession(
        req.params.id,
        req.params.sessionId,
        req.user?.id,
        { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
      );
      res.json({ success: true, message: "Phiên đăng nhập đã được thu hồi" });
    } catch (error) {
      next(error);
    }
  };

  revokeAllUserSessions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.service.revokeAllUserSessions(
        req.params.id,
        req.user?.id,
        { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
      );
      res.json({
        success: true,
        message: `Đã thu hồi ${result.count} phiên đăng nhập`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ────── Device Management ──────

  getUserDevices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getUserDevices(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteUserDevice = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await this.service.deleteUserDevice(
        req.params.id,
        req.params.deviceId,
        req.user?.id,
        { ipAddress: req.ip, userAgent: req.headers["user-agent"] },
      );
      res.json({
        success: true,
        message: "Thiết bị đã được xóa khỏi tài khoản",
      });
    } catch (error) {
      next(error);
    }
  };
}
