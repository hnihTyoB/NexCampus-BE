import { Request, Response, NextFunction } from 'express';
import { systemConfigService, SystemConfigService } from './system-config.service';
import { CreateSystemConfigDto, UpdateSystemConfigDto, ToggleFeatureFlagDto, SystemConfigQueryDto } from './system-config.dto';

export class SystemConfigController {
  constructor(private readonly service: SystemConfigService = systemConfigService) {}

  getPublicConfigs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getPublicConfigs();
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as SystemConfigQueryDto;
      const data = await this.service.findAll(query);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  findByKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = req.params;
      const data = await this.service.get(key);
      res.json({
        success: true,
        data: {
          key,
          value: data,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateSystemConfigDto;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.create(body, context);
      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = req.params;
      const body = req.body as UpdateSystemConfigDto;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.update(key, body, context);
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  toggleFeatureFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = req.params;
      const body = req.body as ToggleFeatureFlagDto;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const data = await this.service.toggleFeatureFlag(key, body, context);
      res.json({
        success: true,
        message: `Feature flag '${key}' updated successfully`,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { key } = req.params;
      const context = {
        actorId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      await this.service.delete(key, context);
      res.json({
        success: true,
        message: `Configuration '${key}' deleted successfully`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const systemConfigController = new SystemConfigController();
