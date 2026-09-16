import { Request, Response, NextFunction } from "express";
import { statsService, StatsService } from "./stats.service";

export class StatsController {
  constructor(private readonly service: StatsService = statsService) {}

  getAdminStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getAdminStats();
      res.status(200).json({
        success: true,
        message: "Lấy thống kê quản trị thành công",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getLeaderStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getLeaderStats(req.user);
      res.status(200).json({
        success: true,
        message: "Lấy thống kê trưởng nhóm thành công",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getInternStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { internId } = req.query;
      const data = await this.service.getInternStats(
        req.user,
        typeof internId === "string" ? internId : undefined
      );
      res.status(200).json({
        success: true,
        message: "Lấy thống kê thực tập sinh thành công",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const statsController = new StatsController();
