import { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { ApplicationQueryDto } from "./application.dto";

const approverSelect = {
  id: true,
  email: true,
  fullName: true,
};

export class ApplicationRepository {
  async findAll(query: ApplicationQueryDto) {
    const {
      status,
      department,
      position,
      email,
      startDateFrom,
      startDateTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.ApplicationWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(department
        ? { department: { contains: department, mode: "insensitive" } }
        : {}),
      ...(position
        ? { position: { contains: position, mode: "insensitive" } }
        : {}),
      ...(email ? { email: { contains: email, mode: "insensitive" } } : {}),
      ...(startDateFrom || startDateTo
        ? {
            startDate: {
              ...(startDateFrom ? { gte: new Date(startDateFrom) } : {}),
              ...(startDateTo ? { lte: new Date(startDateTo) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        include: { approver: { select: approverSelect } },
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.application.count({ where }),
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

  findById(id: string) {
    return prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: { approver: { select: approverSelect } },
    });
  }

  create(data: {
    fullName: string;
    email: string;
    phone: string;
    department: string;
    position: string;
    startDate: Date;
    duration: number;
  }) {
    return prisma.application.create({
      data,
    });
  }

  review(id: string, status: "APPROVED" | "REJECTED", approverId: string) {
    return prisma.application.update({
      where: { id },
      data: {
        status,
        approvedBy: approverId,
        approvedAt: new Date(),
      },
      include: { approver: { select: approverSelect } },
    });
  }

  softDelete(id: string) {
    return prisma.application.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async upsertInvite(email: string, token: string, expiresAt: Date) {
    return prisma.applicationInvite.upsert({
      where: { email },
      update: {
        token,
        expiresAt,
        used: false,
        createdAt: new Date(),
      },
      create: {
        email,
        token,
        expiresAt,
        used: false,
      },
    });
  }

  async findInviteByToken(token: string) {
    return prisma.applicationInvite.findUnique({
      where: { token },
    });
  }

  async markInviteAsUsed(token: string) {
    return prisma.applicationInvite.update({
      where: { token },
      data: { used: true },
    });
  }
}
