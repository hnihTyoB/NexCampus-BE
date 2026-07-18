import { Request, Response, NextFunction } from "express";
import { RegulationService } from "./regulation.service";
import { CreateRegulationDto, UpdateRegulationDto } from "./regulation.dto";

export class RegulationController {
  private readonly service = new RegulationService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const title = req.query.title ? String(req.query.title) : undefined;
      let isActive: boolean | undefined = undefined;
      if (req.query.isActive === "true") isActive = true;
      if (req.query.isActive === "false") isActive = false;

      const result = await this.service.findAll({ page, limit, title, isActive });

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

  findActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findActive();

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const body = req.body as CreateRegulationDto;
      const result = await this.service.create(body, actorId);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const body = req.body as UpdateRegulationDto;
      const result = await this.service.update(req.params.id, body, actorId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      await this.service.delete(req.params.id, actorId);

      res.json({ success: true, message: "Regulation deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const result = await this.service.activate(req.params.id, actorId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
