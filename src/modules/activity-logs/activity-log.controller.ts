import { Request, Response, NextFunction } from "express";
import { ActivityLogService } from "./activity-log.service";
import { ActivityLogQueryDto } from "./activity-log.dto";

export class ActivityLogController {
  private readonly service = new ActivityLogService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as ActivityLogQueryDto;
      const result = await this.service.findAll(query, req.user);

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
