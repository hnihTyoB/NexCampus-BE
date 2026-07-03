import { Request, Response, NextFunction } from 'express';
import { WeeklyEvaluationService } from './weekly-evaluation.service';
import { WeeklyEvaluationQueryDto, CreateWeeklyEvaluationDto, UpdateWeeklyEvaluationDto } from './weekly-evaluation.dto';

export class WeeklyEvaluationController {
  private readonly service = new WeeklyEvaluationService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as WeeklyEvaluationQueryDto;
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
      const leaderId = req.user.id;
      const body = req.body as CreateWeeklyEvaluationDto;
      const result = await this.service.create(body, leaderId);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateWeeklyEvaluationDto;
      const result = await this.service.update(req.params.id, body);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);

      res.json({ success: true, message: 'Weekly evaluation deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
