import { Request, Response, NextFunction } from "express";
import { ApplicationService } from "./application.service";
import {
  ApplicationQueryDto,
  CreateApplicationDto,
  ReviewApplicationDto,
  AssignApplicationDto,
  CreateInviteDto,
  GetApplicationInvitesQuery,
} from "./application.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";

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
      const files = req.files as Express.Multer.File[] || [];
      const result = await this.service.create(body, files);

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

  assign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as AssignApplicationDto;
      const result = await this.service.assign(req.params.id, body);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id);

      res.json({
        success: true,
        message: "Application deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  createInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      const body = req.body as CreateInviteDto;
      const result = await this.service.createInvite(actorId, body);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.query.token as string;
      const result = await this.service.verifyInvite(token);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  revokeInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user.id;
      await this.service.revokeInvite(req.params.id, actorId);

      res.json({
        success: true,
        message: "Invite revoked successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  getApplicationInvites = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as GetApplicationInvitesQuery;
      const result = await this.service.getApplicationInvites(query);

      res.json({ success: true, ...result });
    } catch (error) {
      console.error("[getApplicationInvites]", error);
      next(error);
    }
  };

  getInviteById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getInviteById(req.params.id);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getAttachmentPutUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, fileName, mimeType, fileSize } = req.query as {
        token?: string;
        fileName?: string;
        mimeType?: string;
        fileSize?: string;
      };
      if (!token || !fileName || !mimeType || !fileSize) {
        throw new AppError(
          "token, fileName, mimeType, fileSize query params are required",
          400,
          ERROR_CODE.VALIDATION_ERROR,
        );
      }
      const result = await this.service.getApplicationAttachmentPutUrl(
        token,
        fileName,
        mimeType,
        parseInt(fileSize, 10),
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
