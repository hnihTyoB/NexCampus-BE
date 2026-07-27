import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { DailyReportRepository } from "./daily-report.repository";
import { InternRepository } from "../interns/intern.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { StorageService } from "../../common/services/storage.service";
import { envConfig } from "../../config/env.config";
import {
  DailyReportQueryDto,
  CreateDailyReportDto,
  UpdateDailyReportDto,
} from "./daily-report.dto";
import { ROLES } from "../../common/constants/role.constant";
import { NotificationDispatcher } from "../notifications/notification.dispatcher";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export class DailyReportService {
  private readonly repository = new DailyReportRepository();
  private readonly internRepository = new InternRepository();
  private readonly activityLogService = new ActivityLogService();

  async findAll(query: DailyReportQueryDto, user: UserPayload) {
    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern) {
        throw new AppError(
          "Intern profile not found",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
      query.internId = intern.id;
    }
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const report = await this.repository.findById(id);

    if (!report) {
      throw new AppError("Daily report not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return report;
  }

  async create(data: CreateDailyReportDto, user: UserPayload) {
    const intern = await this.internRepository.findByUserId(user.id);
    if (!intern) {
      throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
    }

    let result;
    try {
      result = await this.repository.create(data, intern.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "You have already submitted a daily report for today",
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
      throw error;
    }

    // Notify the leader of the new daily report
    if (intern.leaderId) {
      await NotificationDispatcher.dispatch(intern.leaderId, "DAILY_REPORT", {
        internName: intern.user.fullName,
      });
    }

    await this.activityLogService.log(
      user.id,
      ACTIVITY_ACTIONS.CREATE_DAILY_REPORT,
      `Intern "${intern.fullName || user.email}" đã nộp báo cáo hàng ngày`,
      result.id,
      "DailyReport",
    );

    return result;
  }

  async update(id: string, data: UpdateDailyReportDto, user: UserPayload) {
    const report = await this.findById(id);

    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern || report.internId !== intern.id) {
        throw new AppError(
          "You are not authorized to update this report",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    return this.repository.update(id, data);
  }

  async uploadVideoDemo(
    id: string,
    file: Express.Multer.File,
    user: UserPayload,
  ) {
    const report = await this.findById(id);

    // 1. Authorization check: Intern can only upload for their own report
    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern || report.internId !== intern.id) {
        throw new AppError(
          "You are not authorized to upload for this report",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // 2. Delete old video file from storage if it exists and was uploaded to our bucket
    const bucket = envConfig.supabase.storageReportBucket;
    const storageService = new StorageService();

    if (report.videoDemo) {
      const prefix = `${envConfig.supabase.url}/storage/v1/object/public/${bucket}/`;
      if (report.videoDemo.startsWith(prefix)) {
        const videoPath = report.videoDemo.replace(prefix, "");
        try {
          await storageService.deleteFile(bucket, videoPath);
        } catch (err) {
          console.error(`Failed to delete old video demo from storage:`, err);
        }
      }
    }

    // 3. Upload new video file
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${id}/video_${randomUUID()}_${safeFileName}`;
    const videoUrl = await storageService.uploadFile(
      bucket,
      filePath,
      file.buffer,
      file.mimetype,
    );

    // 4. Update report in DB
    return this.repository.update(id, { videoDemo: videoUrl });
  }

  async delete(id: string, user: UserPayload) {
    const report = await this.findById(id);

    if (user.role === ROLES.INTERN) {
      const intern = await this.internRepository.findByUserId(user.id);
      if (!intern || report.internId !== intern.id) {
        throw new AppError(
          "You are not authorized to delete this report",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    // Delete associated files from Supabase Storage
    const bucket = envConfig.supabase.storageReportBucket;
    const storageService = new StorageService();

    // 1. Delete report attachments
    if (report.attachments && report.attachments.length > 0) {
      for (const attachment of report.attachments) {
        try {
          await storageService.deleteFile(bucket, attachment.filePath);
        } catch (err) {
          console.error(
            `Failed to delete storage file ${attachment.filePath}:`,
            err,
          );
        }
      }
    }

    // 2. Delete video demo if it is uploaded to our bucket
    if (report.videoDemo) {
      const prefix = `${envConfig.supabase.url}/storage/v1/object/public/${bucket}/`;
      if (report.videoDemo.startsWith(prefix)) {
        const videoPath = report.videoDemo.replace(prefix, "");
        try {
          await storageService.deleteFile(bucket, videoPath);
        } catch (err) {
          console.error(`Failed to delete video demo from storage:`, err);
        }
      }
    }

    return this.repository.delete(id);
  }
}
