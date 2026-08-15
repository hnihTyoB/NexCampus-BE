import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  DailyReportQueryDto,
  CreateDailyReportDto,
  UpdateDailyReportDto,
} from "./daily-report.dto";

const defaultSelect = {
  id: true,
  internId: true,
  content: true,
  prLink: true,
  videoDemo: true,
  createdAt: true,
  updatedAt: true,
  intern: {
    select: {
      id: true,
      userId: true,
      leaderId: true,
      fullName: true,
      phone: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      startDate: true,
      duration: true,
      discordUsername: true,
      discordRoleGranted: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
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
  private parseLocalDate(dateStr: string, isEnd: boolean): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split("-").map(Number);
      if (isEnd) {
        // End of the day is 23:59:59.999 in Asia/Ho_Chi_Minh timezone,
        // which corresponds to start of next day (YYYY-MM-(DD+1) 00:00:00 local time),
        // which is 17:00:00 UTC of current day (YYYY-MM-DD 17:00:00 UTC).
        return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 17, 0, 0, 0));
      } else {
        // Start of the day is 00:00:00 in Asia/Ho_Chi_Minh timezone,
        // which is 17:00:00 UTC of the previous day (YYYY-MM-(DD-1) 17:00:00 UTC).
        return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - 1, 17, 0, 0, 0));
      }
    }
    const date = new Date(dateStr);
    if (isEnd) {
      return new Date(date.getTime() + 24 * 60 * 60 * 1000);
    }
    return date;
  }

  async findAll(query: DailyReportQueryDto) {
    const {
      internId,
      createdAtFrom,
      createdAtTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.DailyReportWhereInput = {
      intern: { deletedAt: null },
      ...(internId ? { internId } : {}),
      ...(createdAtFrom || createdAtTo
        ? {
            createdAt: {
              ...(createdAtFrom ? { gte: this.parseLocalDate(createdAtFrom, false) } : {}),
              ...(createdAtTo ? { lt: this.parseLocalDate(createdAtTo, true) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.dailyReport.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.dailyReport.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.dailyReport.findFirst({
      where: {
        id,
        intern: { deletedAt: null },
      },
      select: defaultSelect,
    });
  }

  create(data: CreateDailyReportDto, internId: string) {
    return prisma.dailyReport.create({
      data: {
        internId,
        content: data.content,
        prLink: data.prLink || null,
        videoDemo: data.videoDemo || null,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateDailyReportDto) {
    return prisma.dailyReport.update({
      where: { id },
      data: {
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.prLink !== undefined ? { prLink: data.prLink } : {}),
        ...(data.videoDemo !== undefined ? { videoDemo: data.videoDemo } : {}),
      },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.dailyReport.delete({
      where: { id },
    });
  }
}
