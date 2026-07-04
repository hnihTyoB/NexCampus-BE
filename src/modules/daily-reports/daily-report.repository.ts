import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.client';
import { DailyReportQueryDto, CreateDailyReportDto, UpdateDailyReportDto } from './daily-report.dto';

const defaultInclude = {
  intern: {
    include: {
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
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
};

export class DailyReportRepository {
  async findAll(query: DailyReportQueryDto) {
    const {
      internId,
      createdAtFrom,
      createdAtTo,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.DailyReportWhereInput = {
      intern: { deletedAt: null },
      ...(internId ? { internId } : {}),
      ...(createdAtFrom || createdAtTo
        ? {
            createdAt: {
              ...(createdAtFrom ? { gte: new Date(createdAtFrom) } : {}),
              ...(createdAtTo ? { lte: new Date(createdAtTo) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.dailyReport.findMany({
        where,
        include: defaultInclude,
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
      include: defaultInclude,
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
      include: defaultInclude,
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
      include: defaultInclude,
    });
  }

  delete(id: string) {
    return prisma.dailyReport.delete({
      where: { id },
    });
  }
}
