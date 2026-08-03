import { Request, Response, NextFunction } from "express";
import { LeaderService } from "./leader.service";
import {
  LeaderQueryDto,
  CreateLeaderDto,
  UpdateLeaderDto,
  UpdateMeLeaderDto,
} from "./leader.dto";

export class LeaderController {
  private readonly service = new LeaderService();

  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getMe(req.user.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateMeLeaderDto;
      const result = await this.service.updateMe(req.user.id, body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as LeaderQueryDto;
      const result = await this.service.findAll(query);
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

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateLeaderDto;
      const result = await this.service.create(body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateLeaderDto;
      const result = await this.service.update(req.params.id, body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: "Leader deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
