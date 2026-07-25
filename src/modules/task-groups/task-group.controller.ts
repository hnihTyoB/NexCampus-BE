import { Request, Response, NextFunction } from "express";
import { TaskGroupService } from "./task-group.service";
import { CreateTaskGroupDto, UpdateTaskGroupDto } from "./task-group.dto";

export class TaskGroupController {
  private readonly service = new TaskGroupService();

  findAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findAll();
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
      const data = await this.service.create(req.body as CreateTaskGroupDto);
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
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);
      res.json({ success: true, message: "Task group deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
