import { Request, Response, NextFunction } from "express";
import { ActivityLogService } from "./activity-log.service";
import { QueryActivityLogInput } from "./activity-log.validation";

export class ActivityLogController {
  private readonly service = new ActivityLogService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as QueryActivityLogInput;
      const result = await this.service.findAll(query);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
