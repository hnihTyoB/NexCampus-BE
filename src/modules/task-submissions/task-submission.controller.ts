import { Request, Response, NextFunction } from 'express';
import { TaskSubmissionService } from './task-submission.service';
import { TaskSubmissionQueryDto, CreateTaskSubmissionDto, UpdateTaskSubmissionDto } from './task-submission.dto';

export class TaskSubmissionController {
  private readonly service = new TaskSubmissionService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as TaskSubmissionQueryDto;
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

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const body = req.body as CreateTaskSubmissionDto;
      const result = await this.service.create(body, user);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const body = req.body as UpdateTaskSubmissionDto;
      const result = await this.service.update(req.params.id, body, user);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      await this.service.delete(req.params.id, user);

      res.json({ success: true, message: 'Task submission deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
