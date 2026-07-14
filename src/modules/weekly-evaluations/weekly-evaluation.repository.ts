import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  WeeklyEvaluationQueryDto,
  CreateWeeklyEvaluationDto,
  UpdateWeeklyEvaluationDto,
} from "./weekly-evaluation.dto";

const defaultSelect = {
  id: true,
  internId: true,
  leaderId: true,
  week: true,
  communication: true,
  attitude: true,
  learning: true,
  coding: true,
  totalScore: true,
  comment: true,
  aiCommunication: true,
  aiAttitude: true,
  aiLearning: true,
  aiCoding: true,
  aiComment: true,
  aiGeneratedAt: true,
  leaderEdited: true,
  createdAt: true,
  updatedAt: true,
  intern: {
    select: {
      id: true,
      userId: true,
      leaderId: true,
      fullName: true,
      phone: true,
      department: true,
      position: true,
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
  leader: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
};

export class WeeklyEvaluationRepository {
  async findAll(query: WeeklyEvaluationQueryDto) {
    const {
      internId,
      leaderId,
      week,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.WeeklyEvaluationWhereInput = {
      intern: { deletedAt: null },
      ...(internId ? { internId } : {}),
      ...(leaderId ? { leaderId } : {}),
      ...(week !== undefined ? { week } : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.weeklyEvaluation.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.weeklyEvaluation.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findById(id: string) {
    return prisma.weeklyEvaluation.findFirst({
      where: {
        id,
        intern: { deletedAt: null },
      },
      select: defaultSelect,
    });
  }

  findByInternAndWeek(internId: string, week: number) {
    return prisma.weeklyEvaluation.findFirst({
      where: {
        internId,
        week,
        intern: { deletedAt: null },
      },
      select: defaultSelect,
    });
  }

  create(
    data: CreateWeeklyEvaluationDto,
    totalScore: number,
    leaderId: string,
    leaderEdited: boolean,
  ) {
    return prisma.weeklyEvaluation.create({
      data: {
        internId: data.internId,
        leaderId,
        week: data.week,
        communication: data.communication,
        attitude: data.attitude,
        learning: data.learning,
        coding: data.coding,
        totalScore,
        comment: data.comment || null,

        // AI suggestion fields (lưu gợi ý gốc)
        aiCommunication: data.aiCommunication ?? null,
        aiAttitude: data.aiAttitude ?? null,
        aiLearning: data.aiLearning ?? null,
        aiCoding: data.aiCoding ?? null,
        aiComment: data.aiComment ?? null,
        aiGeneratedAt: data.aiCommunication != null ? new Date() : null,
        leaderEdited,
      },
      select: defaultSelect,
    });
  }

  update(id: string, data: UpdateWeeklyEvaluationDto, totalScore?: number) {
    return prisma.weeklyEvaluation.update({
      where: { id },
      data: {
        ...(data.communication !== undefined
          ? { communication: data.communication }
          : {}),
        ...(data.attitude !== undefined ? { attitude: data.attitude } : {}),
        ...(data.learning !== undefined ? { learning: data.learning } : {}),
        ...(data.coding !== undefined ? { coding: data.coding } : {}),
        ...(totalScore !== undefined ? { totalScore } : {}),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
      },
      select: defaultSelect,
    });
  }

  delete(id: string) {
    return prisma.weeklyEvaluation.delete({
      where: { id },
    });
  }
}
