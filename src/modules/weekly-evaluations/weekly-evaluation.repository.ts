import { EvaluationGrade, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  CreateWeeklyEvaluationDto,
  UpdateWeeklyEvaluationDto,
  WeeklyEvaluationQueryDto,
} from "./weekly-evaluation.dto";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

export interface WeeklyEvaluationScoping {
  internId?: string;
  leaderId?: string;
  leaderDepartmentIds?: string[];
  directInternIds?: string[];
  isLeader?: boolean;
  isAdmin?: boolean;
}

const defaultEvaluationSelect = {
  id: true,
  internId: true,
  leaderId: true,
  week: true,
  year: true,
  startDate: true,
  endDate: true,
  ratings: true,
  aiRatings: true,
  score: true,
  grade: true,
  comment: true,
  strengths: true,
  weaknesses: true,
  recommendations: true,
  aiScore: true,
  aiComment: true,
  aiStrengths: true,
  aiWeaknesses: true,
  aiRecommendations: true,
  isAiAdjusted: true,
  viewedAt: true,
  createdAt: true,
  updatedAt: true,
  intern: {
    select: {
      id: true,
      fullName: true,
      internCode: true,
      departmentId: true,
      startDate: true,
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
  leader: {
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
    },
  },
};

export class WeeklyEvaluationRepository {
  async findById(id: string) {
    return prisma.weeklyEvaluation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: defaultEvaluationSelect,
    });
  }

  async findByInternAndWeek(internId: string, week: number) {
    return prisma.weeklyEvaluation.findFirst({
      where: {
        internId,
        week,
        deletedAt: null,
      },
      select: defaultEvaluationSelect,
    });
  }

  async create(params: {
    dto: CreateWeeklyEvaluationDto;
    score: number;
    grade: EvaluationGrade;
    leaderId: string;
    isAiAdjusted: boolean;
    startDate: Date;
    endDate: Date;
    year: number;
  }) {
    const { dto, score, grade, leaderId, isAiAdjusted, startDate, endDate, year } = params;
    const effectiveYear = year || new Date().getFullYear();

    return prisma.weeklyEvaluation.create({
      data: {
        internId: dto.internId,
        leaderId,
        week: dto.week,
        year: effectiveYear,
        startDate,
        endDate,
        ratings: dto.ratings as unknown as Prisma.InputJsonValue,
        score,
        grade,
        comment: dto.comment || null,
        strengths: dto.strengths || [],
        weaknesses: dto.weaknesses || [],
        recommendations: dto.recommendations || [],

        aiRatings: dto.aiRatings
          ? (dto.aiRatings as unknown as Prisma.InputJsonValue)
          : undefined,
        aiScore: dto.aiScore,
        aiComment: dto.aiComment || null,
        aiStrengths: dto.aiStrengths || [],
        aiWeaknesses: dto.aiWeaknesses || [],
        aiRecommendations: dto.aiRecommendations || [],
        isAiAdjusted,
      },
      select: defaultEvaluationSelect,
    });
  }

  async update(params: {
    id: string;
    dto: UpdateWeeklyEvaluationDto;
    score?: number;
    grade?: EvaluationGrade;
    isAiAdjusted?: boolean;
  }) {
    const { id, dto, score, grade, isAiAdjusted } = params;

    return prisma.weeklyEvaluation.update({
      where: { id },
      data: {
        ...(dto.ratings && {
          ratings: dto.ratings as unknown as Prisma.InputJsonValue,
        }),
        ...(score !== undefined && { score }),
        ...(grade !== undefined && { grade }),
        ...(dto.comment !== undefined && { comment: dto.comment }),
        ...(dto.strengths !== undefined && { strengths: dto.strengths }),
        ...(dto.weaknesses !== undefined && { weaknesses: dto.weaknesses }),
        ...(dto.recommendations !== undefined && {
          recommendations: dto.recommendations,
        }),
        ...(isAiAdjusted !== undefined && { isAiAdjusted }),
      },
      select: defaultEvaluationSelect,
    });
  }

  async softDelete(id: string) {
    return prisma.weeklyEvaluation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async markViewed(id: string) {
    return prisma.weeklyEvaluation.update({
      where: { id },
      data: {
        viewedAt: new Date(),
      },
      select: defaultEvaluationSelect,
    });
  }

  buildWhereClause(
    query: WeeklyEvaluationQueryDto,
    scoping: WeeklyEvaluationScoping,
  ): Prisma.WeeklyEvaluationWhereInput {
    const where: Prisma.WeeklyEvaluationWhereInput = {
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

    if (query.leaderId) {
      where.leaderId = query.leaderId;
    }

    if (query.week) {
      where.week = query.week;
    }

    if (query.year) {
      where.year = query.year;
    }

    if (query.departmentId) {
      where.intern = {
        ...(where.intern as Prisma.InternWhereInput),
        departmentId: query.departmentId,
      };
    }

    return where;
  }

  async findAll(
    query: WeeklyEvaluationQueryDto,
    scoping: WeeklyEvaluationScoping,
  ) {
    const { page = 1, limit = 20, sortBy = "week", order = "desc" } = query;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(query, scoping);

    const SORT_MAP: Record<
      string,
      Prisma.WeeklyEvaluationOrderByWithRelationInput
    > = {
      week: { week: order },
      year: { year: order },
      score: { score: order },
      createdAt: { createdAt: order },
    };
    const orderBy = SORT_MAP[sortBy] ?? { week: order };

    const [items, total] = await Promise.all([
      prisma.weeklyEvaluation.findMany({
        where,
        select: defaultEvaluationSelect,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.weeklyEvaluation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllByIntern(internId: string) {
    return prisma.weeklyEvaluation.findMany({
      where: {
        internId,
        deletedAt: null,
      },
      select: {
        id: true,
        week: true,
        year: true,
        score: true,
        grade: true,
        comment: true,
        viewedAt: true,
        createdAt: true,
      },
      orderBy: {
        week: "desc",
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

export const weeklyEvaluationRepository = new WeeklyEvaluationRepository();


