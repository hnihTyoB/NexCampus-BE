import { EvaluationGrade, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  CreateWeeklyEvaluationDto,
  UpdateWeeklyEvaluationDto,
  WeeklyEvaluationQueryDto,
} from "./weekly-evaluation.dto";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

export interface WeeklyEvaluationScoping {
  targetUserId?: string;
  internId?: string; // backwards compatibility alias for targetUserId
  evaluatorId?: string;
  leaderId?: string; // backwards compatibility alias for evaluatorId
  departmentIds?: string[];
  directTargetUserIds?: string[];
  isReviewer?: boolean;
  isAdmin?: boolean;
}

const defaultEvaluationSelect = {
  id: true,
  targetUserId: true,
  evaluatorId: true,
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
  targetUser: {
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      internshipProfile: {
        select: {
          id: true,
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
        },
      },
    },
  },
  evaluator: {
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
    },
  },
};

export class WeeklyEvaluationRepository {
  private mapEvaluationCompat<T extends Record<string, any>>(item: T | null): T | null {
    if (!item) return null;
    const targetUser = item.targetUser;
    const intern = targetUser
      ? {
          id: targetUser.internshipProfile?.id || targetUser.id,
          fullName: targetUser.fullName || "",
          internCode: targetUser.internshipProfile?.internCode || null,
          departmentId: targetUser.internshipProfile?.departmentId || null,
          department: targetUser.internshipProfile?.department || null,
          position: targetUser.internshipProfile?.position || null,
          startDate: targetUser.internshipProfile?.startDate || null,
          user: {
            id: targetUser.id,
            email: targetUser.email,
            fullName: targetUser.fullName,
            avatarUrl: targetUser.avatarUrl,
          },
        }
      : null;

    const leader = item.evaluator
      ? {
          id: item.evaluator.id,
          email: item.evaluator.email,
          fullName: item.evaluator.fullName,
          avatarUrl: item.evaluator.avatarUrl,
        }
      : null;

    return {
      ...item,
      internId: item.targetUserId,
      leaderId: item.evaluatorId,
      intern,
      leader,
    };
  }

  async findById(id: string) {
    const item = await prisma.weeklyEvaluation.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: defaultEvaluationSelect,
    });
    return this.mapEvaluationCompat(item);
  }

  async findByTargetUserAndWeek(targetUserId: string, week: number) {
    const item = await prisma.weeklyEvaluation.findFirst({
      where: {
        targetUserId,
        week,
        deletedAt: null,
      },
      select: defaultEvaluationSelect,
    });
    return this.mapEvaluationCompat(item);
  }

  // Alias for backward compatibility
  async findByInternAndWeek(internId: string, week: number) {
    return this.findByTargetUserAndWeek(internId, week);
  }

  async create(params: {
    dto: CreateWeeklyEvaluationDto;
    score: number;
    grade: EvaluationGrade;
    evaluatorId: string;
    isAiAdjusted: boolean;
    startDate: Date;
    endDate: Date;
    year: number;
  }) {
    const { dto, score, grade, evaluatorId, isAiAdjusted, startDate, endDate, year } = params;
    const effectiveYear = year || new Date().getFullYear();
    const targetUserId = dto.targetUserId || dto.internId;

    const item = await prisma.weeklyEvaluation.create({
      data: {
        targetUserId: targetUserId!,
        evaluatorId,
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

    return this.mapEvaluationCompat(item)!;
  }

  async update(params: {
    id: string;
    dto: UpdateWeeklyEvaluationDto;
    score?: number;
    grade?: EvaluationGrade;
    isAiAdjusted?: boolean;
  }) {
    const { id, dto, score, grade, isAiAdjusted } = params;

    const item = await prisma.weeklyEvaluation.update({
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

    return this.mapEvaluationCompat(item)!;
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
    const item = await prisma.weeklyEvaluation.update({
      where: { id },
      data: {
        viewedAt: new Date(),
      },
      select: defaultEvaluationSelect,
    });
    return this.mapEvaluationCompat(item);
  }

  buildWhereClause(
    query: WeeklyEvaluationQueryDto,
    scoping: WeeklyEvaluationScoping,
  ): Prisma.WeeklyEvaluationWhereInput {
    const where: Prisma.WeeklyEvaluationWhereInput = {
      deletedAt: null,
      targetUser: {
        deletedAt: null,
      },
    };

    // Scoping permissions
    const scopedTargetUserId = scoping.targetUserId || scoping.internId;
    if (scopedTargetUserId) {
      where.targetUserId = scopedTargetUserId;
    } else if (scoping.isReviewer && !scoping.isAdmin) {
      const orConditions: Prisma.UserWhereInput[] = [];

      if (scoping.directTargetUserIds && scoping.directTargetUserIds.length > 0) {
        orConditions.push({ id: { in: scoping.directTargetUserIds } });
      }

      if (scoping.departmentIds && scoping.departmentIds.length > 0) {
        orConditions.push({
          internshipProfile: {
            departmentId: { in: scoping.departmentIds },
          },
        });
      }

      if (orConditions.length === 0) {
        where.targetUserId = { in: [] };
      } else {
        where.targetUser = {
          deletedAt: null,
          OR: orConditions,
        };
      }
    }

    // Query filters
    const queryTargetUserId = query.targetUserId || query.internId;
    if (queryTargetUserId) {
      where.targetUserId = queryTargetUserId;
    }

    const queryEvaluatorId = query.evaluatorId || query.leaderId;
    if (queryEvaluatorId) {
      where.evaluatorId = queryEvaluatorId;
    }

    if (query.week) {
      where.week = query.week;
    }

    if (query.year) {
      where.year = query.year;
    }

    if (query.departmentId) {
      where.targetUser = {
        ...(where.targetUser as Prisma.UserWhereInput),
        internshipProfile: {
          departmentId: query.departmentId,
        },
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
      items: items.map((item) => this.mapEvaluationCompat(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllByTargetUser(targetUserId: string) {
    return prisma.weeklyEvaluation.findMany({
      where: {
        targetUserId,
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

  // Alias for backward compatibility
  async findAllByIntern(internId: string) {
    return this.findAllByTargetUser(internId);
  }

  async findUserWithProfile(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        internshipProfile: {
          select: {
            id: true,
            mentorId: true,
            departmentId: true,
            startDate: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
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

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
  }

  async findInternshipProfileById(profileId: string) {
    return prisma.internshipProfile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });
  }

  async findMidWeekReassignLog(targetId: string, after: Date, beforeOrEqual: Date) {
    return prisma.auditLog.findFirst({
      where: {
        action: "ASSIGN_LEADER",
        targetType: "INTERN",
        targetId,
        createdAt: { gt: after, lte: beforeOrEqual },
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
