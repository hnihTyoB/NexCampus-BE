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

  getTaskConflicts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.getTaskConflicts(
        req.params.id,
        req.user!,
      );
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

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.cancel(req.params.id, req.user!, {
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        data,
        message: "Đơn xin nghỉ phép đã được hủy thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  getUploadPresignedUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { fileName, mimeType } = req.body;
      const data = await this.service.getUploadPresignedUrl(
        fileName,
        mimeType,
        req.user!,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
