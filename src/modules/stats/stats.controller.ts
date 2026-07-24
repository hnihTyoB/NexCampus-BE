import { Request, Response, NextFunction } from "express";
import { StatsService } from "./stats.service";

type AuthRequest = Request & {
  user?: { id: string; email: string; role: string };
};

export class StatsController {
  private readonly service = new StatsService();

  getAdminStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized access" });
        return;
      }
      const data = await this.service.getAdminStats();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getLeaderStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized access" });
        return;
      }
      const data = await this.service.getLeaderStats(req.user);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getInternStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized access" });
        return;
      }
      const data = await this.service.getInternStats(req.user);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
