import { Request, Response, NextFunction } from "express";
import { regulationService, RegulationService } from "./regulation.service";
import { CreateRegulationDto, UpdateRegulationDto } from "./regulation.dto";

export class RegulationController {
  constructor(private readonly service: RegulationService = regulationService) {}

  findAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const title = req.query.title ? String(req.query.title) : undefined;
      let isActive: boolean | undefined = undefined;
      if (req.query.isActive === "true") isActive = true;
      else if (req.query.isActive === "false") isActive = false;

      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await this.service.findAll(
        { page, limit, title, isActive },
        userId,
        userRole
      );

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  findById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const result = await this.service.findById(req.params.id, userId, userRole);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  findActive = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const result = await this.service.findActive(userId, userRole);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const actorId = req.user.id;
      const body = req.body as CreateRegulationDto;
      const result = await this.service.create(body, actorId);

      res.status(201).json({
        success: true,
        message: "Tạo quy định mới thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const actorId = req.user.id;
      const body = req.body as UpdateRegulationDto;
      const result = await this.service.update(req.params.id, body, actorId);

      res.status(200).json({
        success: true,
        message: "Cập nhật quy định thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const actorId = req.user.id;
      await this.service.delete(req.params.id, actorId);

      res.status(200).json({
        success: true,
        message: "Xóa quy định thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  activate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const actorId = req.user.id;
      const result = await this.service.activate(req.params.id, actorId);

      res.status(200).json({
        success: true,
        message: "Kích hoạt quy định thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  acknowledge = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const regulationId = req.params.id;
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      const result = await this.service.acknowledge(
        regulationId,
        userId,
        ipAddress,
        userAgent
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

export const regulationController = new RegulationController();
