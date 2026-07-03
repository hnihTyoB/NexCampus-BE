import { Request, Response, NextFunction } from 'express';
import { ApplicationService } from './application.service';
import { ApplicationQueryDto, CreateApplicationDto, ReviewApplicationDto } from './application.dto';

export class ApplicationController {
  private readonly service = new ApplicationService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as ApplicationQueryDto;
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
      const body = req.body as CreateApplicationDto;
      const result = await this.service.create(body);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const approverId = req.user.id;
      const body = req.body as ReviewApplicationDto;
      const result = await this.service.review(req.params.id, body, approverId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);

      res.json({ success: true, message: 'Application deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
