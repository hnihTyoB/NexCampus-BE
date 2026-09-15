import { Request, Response, NextFunction } from "express";
import { AbsenceService } from "./absence.service";
import {
  CreateAbsenceDto,
  ReviewAbsenceDto,
  AbsenceQueryDto,
} from "./absence.dto";

export class AbsenceController {
  private readonly service = new AbsenceService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findAll(
        req.query as unknown as AbsenceQueryDto,
        req.user!,
      );
      res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findById(req.params.id, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(
        req.body as CreateAbsenceDto,
        req.user!,
        { ipAddress: req.ip },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  review = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.review(
        req.params.id,
        req.body as ReviewAbsenceDto,
        req.user!,
        { ipAddress: req.ip },
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
