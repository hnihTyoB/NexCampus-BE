import { Request, Response, NextFunction } from "express";
import { TaskGroupService } from "./task-group.service";
import {
  CreateTaskGroupDto,
  UpdateTaskGroupDto,
  TaskGroupQueryDto,
} from "./task-group.dto";

export class TaskGroupController {
  private readonly service = new TaskGroupService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findAll(
        req.query as unknown as TaskGroupQueryDto,
        req.user,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findById(req.params.id, req.user);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(
        req.body as CreateTaskGroupDto,
        req.user?.id,
        req.user,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.update(
        req.params.id,
        req.body as UpdateTaskGroupDto,
        req.user?.id,
        req.user,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id, req.user?.id, req.user, {
        ipAddress: req.ip,
      });
      res.json({ success: true, message: "Task group deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  getProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getProgress(req.params.id, req.user);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  findTasks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findTasks(req.params.id, req.user);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
