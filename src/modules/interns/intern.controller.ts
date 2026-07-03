import { Request, Response, NextFunction } from 'express';
import { InternService } from './intern.service';
import { InternQueryDto, CreateInternDto, UpdateInternDto } from './intern.dto';

export class InternController {
  private readonly service = new InternService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as InternQueryDto;
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
      const body = req.body as CreateInternDto;
      const result = await this.service.create(body);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateInternDto;
      const result = await this.service.update(req.params.id, body);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);

      res.json({ success: true, message: 'Intern deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
