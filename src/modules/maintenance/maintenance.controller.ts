import { Request, Response, NextFunction } from 'express';
import { maintenanceService, MaintenanceService } from './maintenance.service';

export class MaintenanceController {
  constructor(private service: MaintenanceService = maintenanceService) {}

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await this.service.getConfig();
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  };

  getPublicStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.service.getPublicStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  };

  enable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await this.service.enableMaintenance(req.body, {
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'System maintenance mode enabled successfully',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  };

  updateConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await this.service.updateConfig(req.body, {
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'Maintenance configuration updated successfully',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  };

  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await this.service.disableMaintenance({
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'System maintenance mode disabled successfully',
        data: config,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const maintenanceController = new MaintenanceController();
