import { Request, Response, NextFunction } from "express";
import { TaskAssignmentService } from "./task-assignment.service";
import {
  CreateTaskAssignmentDto,
  AssignTaskDto,
  UpdateTaskAssignmentDto,
  TaskAssignmentQueryDto,
  RejectAssignmentDto,
} from "./task-assignment.dto";

export class TaskAssignmentController {
  private readonly service = new TaskAssignmentService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findAll(
        req.query as unknown as TaskAssignmentQueryDto,
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
        req.body as CreateTaskAssignmentDto,
        req.user!.id,
        req.user?.role,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  assignTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.assignTask(
        req.params.taskId,
        req.body as AssignTaskDto,
        req.user!.id,
        req.user?.role,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  unassignTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.unassignTask(
        req.params.taskId,
        req.user!.id,
        req.user?.role,
        { ipAddress: req.ip },
      );
      res.json({ success: true, message: "Task unassigned successfully" });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.update(
        req.params.id,
        req.body as UpdateTaskAssignmentDto,
        req.user!.id,
        req.user?.role,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.approve(
        req.params.id,
        req.user!.id,
        req.user?.role,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = (req.body || {}) as RejectAssignmentDto;
      const data = await this.service.reject(
        req.params.id,
        reason,
        req.user!.id,
        req.user?.role,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(
        req.params.id,
        req.user!.id,
        req.user?.role,
        { ipAddress: req.ip },
      );
      res.json({ success: true, message: "Assignment cancelled successfully" });
    } catch (error) {
      next(error);
    }
  };

  start = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.startTask(
        req.params.id,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  block = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { blockedReason } = req.body as { blockedReason: string };
      const data = await this.service.blockTask(
        req.params.id,
        req.user!,
        blockedReason,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  unblock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.unblockTask(
        req.params.id,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
