import { Request, Response, NextFunction } from "express";
import { TaskAssignmentService } from "./task-assignment.service";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  AssignTaskDto,
  UpdateTaskAssignmentDto,
} from "./task-assignment.dto";

export class TaskAssignmentController {
  private readonly service = new TaskAssignmentService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as TaskAssignmentQueryDto;
      const result = await this.service.findAll(query, req.user);

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id, req.user);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignedBy = req.user.id;
      const body = req.body as CreateTaskAssignmentDto;
      const result = await this.service.create(body, assignedBy, req.user.role);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  assignTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as AssignTaskDto;
      const result = await this.service.assignTask(
        req.params.taskId,
        body,
        req.user.id,
        req.user.role,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  unassignTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.unassignTask(
        req.params.taskId,
        req.user.id,
        req.user.role,
      );

      res.json({ success: true, message: "Hủy giao việc thành công" });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const body = req.body as UpdateTaskAssignmentDto;
      const result = await this.service.update(req.params.id, body, actorId, req.user.role);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      await this.service.delete(req.params.id, actorId, req.user.role);

      res.json({
        success: true,
        message: "Task assignment deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.approve(req.params.id, req.user.id, req.user.role);
      res.json({ success: true, data: result, message: "Phê duyệt giao việc thành công" });
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.reject(req.params.id, req.user.id, req.user.role);
      res.json({ success: true, message: "Từ chối giao việc thành công" });
    } catch (error) {
      next(error);
    }
  };
}
