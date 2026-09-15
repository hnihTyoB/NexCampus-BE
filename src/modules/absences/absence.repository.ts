import { Prisma, AbsenceStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  AbsenceQueryDto,
  CreateAbsenceDto,
  ReviewAbsenceDto,
} from "./absence.dto";
import { SYSTEM_TARGET_ID } from "../../common/constants/audit-log.constant";

const defaultAbsenceSelect = {
  id: true,
  userId: true,
  startDate: true,
  endDate: true,
  reason: true,
  evidenceUrl: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      intern: {
        select: {
          id: true,
          leaderId: true,
          internCode: true,
        },
      },
    },
  },
  reviewer: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
};

export class AbsenceRepository {
  async findAll(
    query: AbsenceQueryDto,
    scope?: {
      userId?: string;
      leaderUserId?: string;
    },
  ) {
    const {
      status,
      userId,
      startDate,
      endDate,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.AbsenceWhereInput = {
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
      ...(scope?.userId ? { userId: scope.userId } : {}),
      ...(scope?.leaderUserId
        ? {
            user: {
              intern: {
                leaderId: scope.leaderUserId,
              },
            },
          }
        : {}),
      ...(startDate || endDate
        ? {
            startDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      prisma.absence.count({ where }),
      prisma.absence.findMany({
        where,
        select: defaultAbsenceSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.absence.findUnique({
      where: { id },
      select: defaultAbsenceSelect,
    });
  }

  async create(data: CreateAbsenceDto, userId: string) {
    return prisma.absence.create({
      data: {
        userId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        evidenceUrl: data.evidenceUrl || null,
        status: AbsenceStatus.PENDING,
      },
      select: defaultAbsenceSelect,
    });
  }

  async review(
    id: string,
    dto: ReviewAbsenceDto,
    reviewedBy: string,
  ) {
    return prisma.absence.update({
      where: { id },
      data: {
        status: dto.status as AbsenceStatus,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote || null,
      },
      select: defaultAbsenceSelect,
    });
  }

  async createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId || SYSTEM_TARGET_ID,
        details: data.details as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
      },
    });
  }
}
