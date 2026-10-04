import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { getVietnamDayRange } from "../../common/helpers/date.helper";
import {
  CreateDailyReportDto,
  DailyReportQueryDto,
  UpdateDailyReportDto,
} from "./daily-report.dto";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

export interface DailyReportScoping {
  userId?: string;
  internId?: string; // backwards compatibility alias for userId
  departmentIds?: string[];
  mentoredUserIds?: string[];
  isReviewer?: boolean;
  isAdmin?: boolean;
}

const defaultReportSelect = {
  id: true,
  userId: true,
  date: true,
  content: true,
  blockers: true,
  nextPlan: true,
  hoursWorked: true,
  prLink: true,
  videoDemo: true,
  feedback: true,
  feedbackBy: true,
  feedbackAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      phoneNumber: true,
      internshipProfile: {
        select: {
          id: true,
          internCode: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          position: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  feedbackUser: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  attachments: {
    select: {
      id: true,
      reportId: true,
      fileName: true,
      fileUrl: true,
      filePath: true,
      mimeType: true,
      fileSize: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
};

export class DailyReportRepository {
  async findById(id: string) {
    return prisma.dailyReport.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: defaultReportSelect,
    });
  }

  async findByUserAndDate(userId: string, date: Date) {
    return prisma.dailyReport.findFirst({
      where: {
        userId,
        date,
        deletedAt: null,
      },
      select: defaultReportSelect,
    });
  }

  // Alias for backward compatibility
  async findByInternAndDate(internId: string, date: Date) {
    return this.findByUserAndDate(internId, date);
  }

  async upsert(
    userId: string,
    date: Date,
    data: CreateDailyReportDto,
    uploaderUserId: string,
  ) {
    const existing = await this.findByUserAndDate(userId, date);

    if (existing) {
      // Update existing report
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.dailyReport.update({
          where: { id: existing.id },
          data: {
            content: data.content,
            blockers: data.blockers !== undefined ? data.blockers : existing.blockers,
            nextPlan: data.nextPlan !== undefined ? data.nextPlan : existing.nextPlan,
            hoursWorked: data.hoursWorked !== undefined ? data.hoursWorked : existing.hoursWorked,
            prLink: data.prLink !== undefined ? data.prLink : existing.prLink,
            videoDemo: data.videoDemo !== undefined ? data.videoDemo : existing.videoDemo,
          },
        });

        if (data.attachments && data.attachments.length > 0) {
          await tx.reportAttachment.createMany({
            data: data.attachments.map((att) => ({
              reportId: existing.id,
              fileName: att.fileName,
              fileUrl: att.fileUrl,
              filePath: att.filePath,
              mimeType: att.mimeType,
              fileSize: att.fileSize,
              uploadedBy: uploaderUserId,
            })),
          });
        }

        return tx.dailyReport.findUnique({
          where: { id: updated.id },
          select: defaultReportSelect,
        });
      });
    }

    // Create brand new report
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.dailyReport.create({
        data: {
          userId,
          date,
          content: data.content,
          blockers: data.blockers || null,
          nextPlan: data.nextPlan || null,
          hoursWorked: data.hoursWorked ?? 8,
          prLink: data.prLink || null,
          videoDemo: data.videoDemo || null,
          attachments:
            data.attachments && data.attachments.length > 0
              ? {
                  create: data.attachments.map((att) => ({
                    fileName: att.fileName,
                    fileUrl: att.fileUrl,
                    filePath: att.filePath,
                    mimeType: att.mimeType,
                    fileSize: att.fileSize,
                    uploadedBy: uploaderUserId,
                  })),
                }
              : undefined,
        },
        select: defaultReportSelect,
      });

      return created;
    });
  }

  async update(id: string, data: UpdateDailyReportDto, uploaderUserId?: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.dailyReport.update({
        where: { id },
        data: {
          ...(data.content !== undefined && { content: data.content }),
          ...(data.blockers !== undefined && { blockers: data.blockers }),
          ...(data.nextPlan !== undefined && { nextPlan: data.nextPlan }),
          ...(data.hoursWorked !== undefined && { hoursWorked: data.hoursWorked }),
          ...(data.prLink !== undefined && { prLink: data.prLink }),
          ...(data.videoDemo !== undefined && { videoDemo: data.videoDemo }),
        },
      });

      if (data.attachments && data.attachments.length > 0 && uploaderUserId) {
        await tx.reportAttachment.createMany({
          data: data.attachments.map((att) => ({
            reportId: id,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            filePath: att.filePath,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            uploadedBy: uploaderUserId,
          })),
        });
      }

      return tx.dailyReport.findUnique({
        where: { id: updated.id },
        select: defaultReportSelect,
      });
    });
  }

  async addFeedback(id: string, feedback: string, feedbackBy: string) {
    return prisma.dailyReport.update({
      where: { id },
      data: {
        feedback,
        feedbackBy,
        feedbackAt: new Date(),
      },
      select: defaultReportSelect,
    });
  }

  async softDelete(id: string) {
    return prisma.dailyReport.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  buildWhereClause(
    query: DailyReportQueryDto,
    scoping: DailyReportScoping,
  ): Prisma.DailyReportWhereInput {
    const where: Prisma.DailyReportWhereInput = {
      deletedAt: null,
      user: {
        deletedAt: null,
      },
    };

    // Scoping permissions
    const scopedUserId = scoping.userId || scoping.internId;
    if (scopedUserId) {
      where.userId = scopedUserId;
    } else if (scoping.isReviewer && !scoping.isAdmin) {
      const orConditions: Prisma.UserWhereInput[] = [];

      if (scoping.mentoredUserIds && scoping.mentoredUserIds.length > 0) {
        orConditions.push({ id: { in: scoping.mentoredUserIds } });
      }

      if (scoping.departmentIds && scoping.departmentIds.length > 0) {
        orConditions.push({
          internshipProfile: {
            departmentId: { in: scoping.departmentIds },
          },
        });
      }

      if (orConditions.length === 0) {
        where.userId = { in: [] };
      } else {
        where.user = {
          deletedAt: null,
          OR: orConditions,
        };
      }
    }

    // Query filters
    const queryUserId = query.userId || query.internId;
    if (queryUserId) {
      where.userId = queryUserId;
    }

    if (query.departmentId) {
      where.user = {
        ...(where.user as Prisma.UserWhereInput),
        internshipProfile: {
          departmentId: query.departmentId,
        },
      };
    }

    if (query.date) {
      const d = new Date(query.date);
      if (!isNaN(d.getTime())) {
        where.date = getVietnamDayRange(d).startOfDay;
      }
    } else if (query.from || query.to) {
      const fromDate =
        query.from && !isNaN(new Date(query.from).getTime())
          ? getVietnamDayRange(query.from).startOfDay
          : undefined;
      const toDate =
        query.to && !isNaN(new Date(query.to).getTime())
          ? getVietnamDayRange(query.to).endOfDay
          : undefined;

      if (fromDate || toDate) {
        where.date = {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        };
      }
    }

    return where;
  }

  async findAll(query: DailyReportQueryDto, scoping: DailyReportScoping) {
    const { page = 1, limit = 20, sortBy = "date", order = "desc" } = query;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(query, scoping);

    const SORT_MAP: Record<string, Prisma.DailyReportOrderByWithRelationInput> = {
      date: { date: order },
      createdAt: { createdAt: order },
      updatedAt: { updatedAt: order },
    };
    const orderBy = SORT_MAP[sortBy] ?? { date: order };

    const [items, total] = await Promise.all([
      prisma.dailyReport.findMany({
        where,
        select: defaultReportSelect,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.dailyReport.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findReportsByUserAndMonth(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return prisma.dailyReport.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        date: true,
        hoursWorked: true,
        feedback: true,
        feedbackAt: true,
      },
      orderBy: {
        date: "asc",
      },
    });
  }

  // Alias for backward compatibility
  async findReportsByInternAndMonth(
    internId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.findReportsByUserAndMonth(internId, startDate, endDate);
  }

  async findAttachmentById(id: string) {
    return prisma.reportAttachment.findUnique({
      where: { id },
      include: {
        report: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async deleteAttachment(id: string) {
    return prisma.reportAttachment.delete({
      where: { id },
    });
  }

  async findInternshipProfileByUserId(userId: string) {
    return prisma.internshipProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        mentorId: true,
        departmentId: true,
        startDate: true,
      },
    });
  }

  async isDepartmentManager(departmentId: string, userId: string): Promise<boolean> {
    const mgr = await prisma.departmentManager.findUnique({
      where: {
        departmentId_userId: { departmentId, userId },
      },
      select: { userId: true },
    });
    return !!mgr;
  }

  async findActiveUserById(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: { id: true, fullName: true, email: true, isActive: true },
    });
  }

  async updateVideoDemo(reportId: string, videoUrl: string) {
    return prisma.dailyReport.update({
      where: { id: reportId },
      data: { videoDemo: videoUrl },
      include: {
        attachments: true,
        user: true,
      },
    });
  }

  async addAttachment(data: {
    reportId: string;
    fileName: string;
    fileUrl: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
  }) {
    return prisma.reportAttachment.create({
      data,
    });
  }

  async findManagedDepartmentIds(userId: string): Promise<string[]> {
    const records = await prisma.departmentManager.findMany({
      where: { userId },
      select: { departmentId: true },
    });
    return records.map((r) => r.departmentId);
  }

  async findMenteeUserIds(mentorId: string): Promise<string[]> {
    const records = await prisma.internshipProfile.findMany({
      where: { mentorId, deletedAt: null },
      select: { userId: true },
    });
    return records.map((r) => r.userId);
  }

  async findUserWithProfile(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        createdAt: true,
        internshipProfile: {
          select: {
            id: true,
            startDate: true,
            departmentId: true,
            mentorId: true,
          },
        },
      },
    });
  }

  async findApprovedLeavesForMonth(userId: string, startDate: Date, endDate: Date) {
    return prisma.absence.findMany({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        durationUnit: true,
        reasonType: true,
        reason: true,
      },
    });
  }

  createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return activityLogRepository.create(data);
  }
}

export const dailyReportRepository = new DailyReportRepository();
