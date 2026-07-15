import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { ApplicationQueryDto, GetApplicationInvitesQuery } from "./application.dto";

const approverSelect = {
  id: true,
  email: true,
  fullName: true,
};

const defaultSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  department: true,
  position: true,
  startDate: true,
  duration: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  regulationId: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
  approver: {
    select: approverSelect,
  },
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
        select: defaultSelect,
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
      select: defaultSelect,
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
    regulationId: string;
    acceptedAt: Date;
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
      select: defaultSelect,
    });
  }

  softDelete(id: string) {
    return prisma.application.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Application Invites ────────────────────────────────────────────────

  async findActiveInviteByEmail(email: string) {
    return prisma.applicationInvite.findFirst({
      where: {
        email,
        status: "ACTIVE",
        expiresAt: { gte: new Date() },
      },
    });
  }

  async createInvite(data: {
    email: string;
    token: string;
    expiresAt: Date;
    createdBy: string;
  }) {
    return prisma.applicationInvite.create({
      data: {
        email: data.email,
        token: data.token,
        status: "ACTIVE",
        expiresAt: data.expiresAt,
        createdBy: data.createdBy,
      },
    });
  }

  findInviteByToken(token: string) {
    return prisma.applicationInvite.findUnique({
      where: { token },
    });
  }

  findInviteById(id: string) {
    return prisma.applicationInvite.findUnique({
      where: { id },
      include: {
        application: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            department: true,
            position: true,
            status: true,
            startDate: true,
            duration: true,
            createdAt: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  markInviteAsUsed(token: string, applicationId: string) {
    return prisma.applicationInvite.update({
      where: { token },
      data: { status: "USED", usedAt: new Date(), applicationId },
    });
  }

  markInviteExpired(token: string) {
    return prisma.applicationInvite.update({
      where: { token },
      data: { status: "EXPIRED" },
    });
  }

  revokeInvite(id: string) {
    return prisma.applicationInvite.update({
      where: { id },
      data: { status: "REVOKED" },
    });
  }

  // ─── Invite list (GET /applications/invites) ────────────────────────────

  async markExpiredInvites() {
    return prisma.applicationInvite.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  }

  async findApplicationInvites(query: GetApplicationInvitesQuery) {
    const {
      email,
      inviteStatus,
      applicationStatus,
      department,
      position,
      createdFrom,
      createdTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.ApplicationInviteWhereInput = {
      ...(email ? { email: { contains: email, mode: "insensitive" } } : {}),
      ...(inviteStatus ? { status: inviteStatus as any } : {}),
      ...(applicationStatus || department || position
        ? {
            application: {
              ...(applicationStatus
                ? { status: applicationStatus as any }
                : {}),
              ...(department
                ? {
                    department: {
                      contains: department,
                      mode: "insensitive",
                    },
                  }
                : {}),
              ...(position
                ? { position: { contains: position, mode: "insensitive" } }
                : {}),
            },
          }
        : {}),
      ...(createdFrom || createdTo
        ? {
            createdAt: {
              ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
              ...(createdTo ? { lte: new Date(createdTo) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.applicationInvite.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
        include: {
          application: {
            select: {
              id: true,
              fullName: true,
              department: true,
              position: true,
              status: true,
              startDate: true,
              duration: true,
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      prisma.applicationInvite.count({ where }),
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
}
