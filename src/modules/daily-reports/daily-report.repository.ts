import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { getVietnamDayRange } from "../../common/helpers/date.helper";
import {
  CreateDailyReportDto,
  CreateReportAttachmentInput,
  DailyReportQueryDto,
  UpdateDailyReportDto,
} from "./daily-report.dto";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

export interface DailyReportScoping {
  internId?: string;
  leaderDepartmentIds?: string[];
  directInternIds?: string[];
  isLeader?: boolean;
  isAdmin?: boolean;
}

const defaultReportSelect = {
  id: true,
  internId: true,
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
  intern: {
    select: {
      id: true,
      fullName: true,
      phone: true,
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
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
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

  async findByInternAndDate(internId: string, date: Date) {
    return prisma.dailyReport.findFirst({
      where: {
        internId,
        date,
        deletedAt: null,
      },
      select: defaultReportSelect,
    });
  }

  async upsert(
    internId: string,
    date: Date,
    data: CreateDailyReportDto,
    uploaderUserId: string,
  ) {
    const existing = await this.findByInternAndDate(internId, date);

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
          internId,
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
      intern: {
        deletedAt: null,
      },
    };

    // Scoping permissions
    if (scoping.internId) {
      where.internId = scoping.internId;
    } else if (scoping.isLeader) {
      const orConditions: Prisma.InternWhereInput[] = [
        ...(scoping.directInternIds && scoping.directInternIds.length > 0
          ? [{ id: { in: scoping.directInternIds } }]
          : []),
        ...(scoping.leaderDepartmentIds && scoping.leaderDepartmentIds.length > 0
          ? [{ departmentId: { in: scoping.leaderDepartmentIds } }]
          : []),
      ];

      if (orConditions.length === 0) {
        where.internId = { in: [] };
      } else {
        where.intern = {
          deletedAt: null,
          OR: orConditions,
        };
      }
    }

    // Query filters
    if (query.internId) {
      where.internId = query.internId;
    }

    if (query.departmentId) {
      where.intern = {
        ...(where.intern as Prisma.InternWhereInput),
        departmentId: query.departmentId,
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

  async findReportsByInternAndMonth(
    internId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return prisma.dailyReport.findMany({
      where: {
        internId,
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

  async findAttachmentById(id: string) {
    return prisma.reportAttachment.findUnique({
      where: { id },
      include: {
        report: {
          select: {
            id: true,
            internId: true,
            intern: {
              select: {
                userId: true,
              },
            },
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
