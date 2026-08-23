import { Request, Response, NextFunction } from 'express';
import { IntegrationService } from './integration.service';

export class IntegrationController {
  private readonly service = new IntegrationService();

  // ── API Keys Handlers ────────────────────────────────────────────────────────
  createApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createApiKey(req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: result,
        message: 'API Key created successfully. Please copy the key now as it will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  };

  listApiKeys = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listApiKeys(req.user.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteApiKey(req.user.id, req.params.id);
      res.json({
        success: true,
        message: 'API Key revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  toggleApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isActive = req.body.isActive ?? false;
      await this.service.toggleApiKey(req.user.id, req.params.id, isActive);
      res.json({
        success: true,
        message: `API Key ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Webhook Handlers ─────────────────────────────────────────────────────────
  createWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createWebhook(req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Webhook endpoint registered successfully. Please save your secret key securely.',
      });
    } catch (error) {
      next(error);
    }
  };

  listWebhooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listWebhooks(req.user.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getWebhookById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getWebhookById(req.user.id, req.params.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.updateWebhook(req.user.id, req.params.id, req.body);
      res.json({
        success: true,
        message: 'Webhook endpoint updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteWebhook(req.user.id, req.params.id);
      res.json({
        success: true,
        message: 'Webhook endpoint deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  testPingWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.testPingWebhook(req.user.id, req.params.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listDeliveries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items, total, page, limit, totalPages } = await this.service.listDeliveries(
        req.user.id,
        req.params.id,
        req.query as any,
      );
      res.json({
        success: true,
        data: items,
        meta: { total, page, limit, totalPages },
      });
    } catch (error) {
      next(error);
    }
  };

  retryDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.retryDelivery(req.user.id, req.params.deliveryId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Third-Party Job Demo (Auth via API Key) ──────────────────────────────────
  triggerDemoJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.triggerDemoJob(req.user.id, req.body);
      res.status(202).json({
        success: true,
        data: result,
        message: 'Job accepted and processing. Callback will be sent to registered webhooks upon completion.',
      });
    } catch (error) {
      next(error);
    }
  };
}
