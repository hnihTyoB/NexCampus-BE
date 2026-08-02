import { Request, Response, NextFunction } from "express";
import { DepartmentService } from "./department.service";
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreatePositionDto,
  UpdatePositionDto,
} from "./department.dto";

export class DepartmentController {
  private readonly service = new DepartmentService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.query as { name?: string; leader?: string };
      const data = await this.service.findAll(req.user, filters);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findById(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const data = await this.service.create(req.body as CreateDepartmentDto, actorId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const data = await this.service.update(req.params.id, req.body as UpdateDepartmentDto, actorId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      await this.service.delete(req.params.id, actorId);
      res.json({ success: true, message: "Department deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  // ─── Positions ───────────────────────────────────────────────────

  findPositionsByDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findPositionsByDepartment(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createPosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const data = await this.service.createPosition(req.body as CreatePositionDto, actorId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updatePosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const data = await this.service.updatePosition(req.params.id, req.body as UpdatePositionDto, actorId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deletePosition = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      await this.service.deletePosition(req.params.id, actorId);
      res.json({ success: true, message: "Position deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
