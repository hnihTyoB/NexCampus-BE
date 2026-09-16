import { Request, Response, NextFunction } from "express";
import { ApplicationService } from "./application.service";

export class ApplicationController {
  private readonly service = new ApplicationService();

  // ─── Invites ──────────────────────────────────────────────────────────────

  createInvite = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      const result = await this.service.createInvite(actorId, req.body, context);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyInvite = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = (req.params.token || req.query.token) as string;
      const result = await this.service.verifyInvite(token);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAllInvites = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.findAllInvites(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  findInviteById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.findInviteById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  revokeInvite = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      const result = await this.service.revokeInvite(
        actorId,
        req.params.id,
        context,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ─── Applications (Public & Admin) ────────────────────────────────────────

  submitApplication = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      const result = await this.service.submitApplication(req.body, context);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.findAll(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  findById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.findById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  assign = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      const result = await this.service.assign(
        actorId,
        req.params.id,
        req.body,
        context,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  approve = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      const result = await this.service.approve(
        actorId,
        req.params.id,
        req.body,
        context,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  reject = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      const result = await this.service.reject(
        actorId,
        req.params.id,
        req.body,
        context,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  review = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      const result = await this.service.review(
        actorId,
        req.params.id,
        req.body,
        context,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const context = {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      };

      await this.service.delete(actorId, req.params.id, context);
      res.status(200).json({
        success: true,
        message: "Application deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getStats = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.getStats();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getAttachmentUploadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = req.query.token as string;
      const fileName = req.query.fileName as string;
      const contentType = req.query.contentType as string;

      const result = await this.service.getAttachmentUploadUrl(
        token,
        fileName,
        contentType,
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
