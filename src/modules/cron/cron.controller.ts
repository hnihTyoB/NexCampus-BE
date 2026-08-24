import { Request, Response, NextFunction } from 'express';
import { cronService, CronService } from './cron.service';
import { CronJobName } from '../../common/constants/cron.constant';

export class CronController {
  constructor(private readonly service: CronService = cronService) {}

  listJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const search = req.query.search as string | undefined;
      const jobs = await this.service.listJobs(search);
      res.json({
        success: true,
        data: jobs,
      });
    } catch (error) {
      next(error);
    }
  };

  triggerJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobName = req.params.jobName as CronJobName;
      const params = req.body?.params || {};

      const result = await this.service.triggerJob(jobName, params, {
        actorId: req.user?.id,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: `Tác vụ '${jobName}' đã được kích hoạt và thực thi thành công`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const cronController = new CronController();
