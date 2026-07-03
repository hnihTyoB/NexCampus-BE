import { Request, Response, NextFunction } from 'express';
import { TaskService } from './task.service';
import { TaskQueryDto, CreateTaskDto, UpdateTaskDto } from './task.dto';

export class TaskController {
  private readonly service = new TaskService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as TaskQueryDto;
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
      const createdBy = req.user.id;
      const body = req.body as CreateTaskDto;
      const result = await this.service.create(body, createdBy);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateTaskDto;
      const result = await this.service.update(req.params.id, body);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);

      res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
