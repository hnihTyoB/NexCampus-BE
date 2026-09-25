import { Request, Response, NextFunction } from "express";
import { WeeklyEvaluationService } from "./weekly-evaluation.service";
import {
  AiSuggestInput,
  CreateWeeklyEvaluationInput,
  QueryWeeklyEvaluationInput,
  UpdateWeeklyEvaluationInput,
} from "./weekly-evaluation.validation";

export class WeeklyEvaluationController {
  private readonly service = new WeeklyEvaluationService();

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateWeeklyEvaluationInput;
      const result = await this.service.create(body, req.user!, {
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getAiSuggestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as AiSuggestInput;
      const result = await this.service.getAiSuggestion(body, req.user!);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as QueryWeeklyEvaluationInput;
      const result = await this.service.findAll(query, req.user!);

      res.status(200).json({
        success: true,
        data: result.items,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findById(req.params.id, req.user!);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as UpdateWeeklyEvaluationInput;
      const result = await this.service.update(req.params.id, body, req.user!, {
        ipAddress: req.ip,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.delete(req.params.id, req.user!, {
        ipAddress: req.ip,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  confirmView = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.confirmView(
        req.params.id,
        req.user!,
        { ipAddress: req.ip },
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getSummary(
        req.params.internId,
        req.user!,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
