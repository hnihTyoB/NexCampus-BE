import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  APPLICATION_STATUS,
  APPLICATION_INVITE_STATUS,
} from "../../common/constants/application.constant";
import {
  ApplicationDto,
  ApplicationInviteDto,
  ApplicationQueryDto,
  GetApplicationInvitesQuery,
  CreateApplicationDto,
  AssignApplicationDto,
} from "./application.dto";

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
};

const applicationSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  university: true,
  major: true,
  cvUrl: true,
  preferredDepartment: true,
  preferredPosition: true,
  departmentId: true,
  positionId: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  startDate: true,
  duration: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  rejectedBy: true,
  rejectedAt: true,
  rejectedReason: true,
  regulationId: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
  approver: { select: userSelect },
  rejecter: { select: userSelect },
  attachments: {
    select: {
      id: true,
      applicationId: true,
      fileName: true,
      fileUrl: true,
      filePath: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ApplicationSelect;

const inviteSelect = {
  id: true,
  email: true,
  token: true,
  status: true,
  expiresAt: true,
  usedAt: true,
  applicationId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  application: {
    select: {
      id: true,
      fullName: true,
      status: true,
    },
  },
} satisfies Prisma.ApplicationInviteSelect;

export class ApplicationRepository {
  // ─── Application Invites ──────────────────────────────────────────────────

  createInvite(data: {
    email: string;
    token: string;
    expiresAt: Date;
    createdBy?: string;
  }): Promise<ApplicationInviteDto> {
    return prisma.applicationInvite.create({
      data: {
        email: data.email.toLowerCase().trim(),
        token: data.token,
        status: APPLICATION_INVITE_STATUS.UNUSED,
        expiresAt: data.expiresAt,
        createdBy: data.createdBy,
      },
      select: inviteSelect,
    });
  }

  findInviteByToken(token: string): Promise<ApplicationInviteDto | null> {
    return prisma.applicationInvite.findUnique({
      where: { token },
      select: inviteSelect,
    });
  }

  findActiveInviteByEmail(email: string): Promise<ApplicationInviteDto | null> {
    const normalized = email.toLowerCase().trim();
    return prisma.applicationInvite.findFirst({
      where: {
        email: normalized,
        status: { in: [APPLICATION_INVITE_STATUS.UNUSED, APPLICATION_INVITE_STATUS.ACTIVE] },
        expiresAt: { gt: new Date() },
      },
      select: inviteSelect,
    });
  }

  findInviteById(id: string): Promise<ApplicationInviteDto | null> {
    return prisma.applicationInvite.findUnique({
      where: { id },
      select: inviteSelect,
    });
  }

  async findInvites(query: GetApplicationInvitesQuery): Promise<{
    data: ApplicationInviteDto[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      email,
      status,
      inviteStatus,
      applicationStatus,
      departmentId,
      positionId,
      createdFrom,
      createdTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.ApplicationInviteWhereInput = {};

    if (email) {
      where.email = { contains: email.trim(), mode: "insensitive" };
    }

    const effectiveStatus = status || inviteStatus;
    if (effectiveStatus) {
      where.status = effectiveStatus;
    }

    if (applicationStatus || departmentId || positionId) {
      where.application = {
        ...(applicationStatus ? { status: applicationStatus } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(positionId ? { positionId } : {}),
        deletedAt: null,
      };
    }

    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) where.createdAt.gte = new Date(createdFrom);
      if (createdTo) where.createdAt.lte = new Date(createdTo);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.applicationInvite.findMany({
        where,
        select: inviteSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.applicationInvite.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  revokeInvite(id: string): Promise<ApplicationInviteDto> {
    return prisma.applicationInvite.update({
      where: { id },
      data: { status: APPLICATION_INVITE_STATUS.REVOKED },
      select: inviteSelect,
    });
  }

  markInviteExpired(token: string): Promise<void> {
    return prisma.applicationInvite
      .updateMany({
        where: { token, status: { in: [APPLICATION_INVITE_STATUS.UNUSED, APPLICATION_INVITE_STATUS.ACTIVE] } },
        data: { status: APPLICATION_INVITE_STATUS.EXPIRED },
      })
      .then(() => undefined);
  }

  // ─── Applications ─────────────────────────────────────────────────────────

  async findAll(query: ApplicationQueryDto): Promise<{
    data: ApplicationDto[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      search,
      status,
      departmentId,
      positionId,
      email,
      startDateFrom,
      startDateTo,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const andConditions: Prisma.ApplicationWhereInput[] = [{ deletedAt: null }];

    if (search) {
      const term = search.trim();
      andConditions.push({
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { phone: { contains: term } },
          { university: { contains: term, mode: "insensitive" } },
          { major: { contains: term, mode: "insensitive" } },
        ],
      });
    }

    if (status) {
      andConditions.push({ status });
    }

    if (departmentId) {
      andConditions.push({ departmentId });
    }

    if (positionId) {
      andConditions.push({ positionId });
    }

    if (email) {
      andConditions.push({ email: { contains: email.trim(), mode: "insensitive" } });
    }

    if (startDateFrom || startDateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDateFrom) dateFilter.gte = new Date(startDateFrom);
      if (startDateTo) dateFilter.lte = new Date(startDateTo);
      andConditions.push({ startDate: dateFilter });
    }

    const where: Prisma.ApplicationWhereInput = { AND: andConditions };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        select: applicationSelect,
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
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  findById(id: string): Promise<ApplicationDto | null> {
    return prisma.application.findFirst({
      where: { id, deletedAt: null },
      select: applicationSelect,
    });
  }

  findPendingOrApprovedByEmail(email: string): Promise<{ id: string } | null> {
    return prisma.application.findFirst({
      where: {
        email: { equals: email.toLowerCase().trim(), mode: "insensitive" },
        status: { in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED] },
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  findPendingOrApprovedByPhone(phone: string): Promise<{ id: string } | null> {
    return prisma.application.findFirst({
      where: {
        phone,
        status: { in: [APPLICATION_STATUS.PENDING, APPLICATION_STATUS.APPROVED] },
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  /**
   * Tạo đơn ứng tuyển kèm tệp đính kèm và đánh dấu token thư mời thành USED trong một Transaction duy nhất.
   */
  async createWithInvite(
    data: CreateApplicationDto,
    duration: number,
  ): Promise<ApplicationDto> {
    return prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          fullName: data.fullName,
          email: data.email.toLowerCase().trim(),
          phone: data.phone,
          university: data.university,
          major: data.major,
          cvUrl: data.cvUrl,
          preferredDepartment: data.preferredDepartment,
          preferredPosition: data.preferredPosition,
          startDate: new Date(data.startDate),
          duration,
          status: APPLICATION_STATUS.PENDING,
          regulationId: data.regulationId,
          acceptedAt: data.acceptedRegulations ? new Date() : null,
        },
      });

      if (data.uploadedFiles && data.uploadedFiles.length > 0) {
        await tx.applicationAttachment.createMany({
          data: data.uploadedFiles.map((f) => ({
            applicationId: app.id,
            fileName: f.fileName,
            filePath: f.filePath,
            fileUrl: f.filePath.startsWith("http")
              ? f.filePath
              : `/uploads/${f.filePath}`,
            mimeType: f.mimeType,
            fileSize: f.fileSize,
          })),
        });
      }

      // Đánh dấu token invite tương ứng sang USED
      await tx.applicationInvite.update({
        where: { token: data.token },
        data: {
          status: APPLICATION_INVITE_STATUS.USED,
          usedAt: new Date(),
          applicationId: app.id,
        },
      });

      const full = await tx.application.findUnique({
        where: { id: app.id },
        select: applicationSelect,
      });

      return full!;
    });
  }

  assign(
    id: string,
    assignment: AssignApplicationDto,
  ): Promise<ApplicationDto> {
    return prisma.application.update({
      where: { id },
      data: {
        departmentId: assignment.departmentId,
        positionId: assignment.positionId,
      },
      select: applicationSelect,
    });
  }

  /**
   * Phê duyệt đơn ứng tuyển:
   * - Tạo tài khoản User (Role INTERN)
   * - Tạo hồ sơ Intern (kèm internCode)
   * - Chuyển application sang APPROVED
   */
  async approveWithAccount(
    id: string,
    approverId: string,
    accountData: {
      email: string;
      passwordHash: string;
      fullName: string;
      roleId: string;
    },
    internData: {
      phone: string;
      departmentId: string;
      positionId: string;
      startDate: Date;
      duration: number;
      leaderId?: string;
      university?: string | null;
      major?: string | null;
      internCodePrefix?: string;
    },
  ): Promise<{
    application: ApplicationDto;
    user: { id: string; email: string | null };
    intern: { id: string; internCode: string | null };
  }> {
    return prisma.$transaction(async (tx) => {
      // 1. Cập nhật đơn sang APPROVED
      const application = await tx.application.update({
        where: { id },
        data: {
          status: APPLICATION_STATUS.APPROVED,
          approvedBy: approverId,
          approvedAt: new Date(),
        },
        select: applicationSelect,
      });

      // 2. Tạo tài khoản User
      const user = await tx.user.create({
        data: {
          email: accountData.email,
          password: accountData.passwordHash,
          fullName: accountData.fullName,
          roleId: accountData.roleId,
          isActive: true,
        },
        select: { id: true, email: true },
      });

      // 3. Tạo hồ sơ Intern
      const prefix = internData.internCodePrefix || "INT";
      const intern = await tx.intern.create({
        data: {
          userId: user.id,
          leaderId: internData.leaderId,
          fullName: accountData.fullName,
          phone: internData.phone,
          departmentId: internData.departmentId,
          positionId: internData.positionId,
          startDate: internData.startDate,
          duration: internData.duration,
          university: internData.university,
          major: internData.major,
          status: "ACTIVE",
        },
        select: { id: true, internCode: true },
      });

      const generatedCode = `${prefix}-${intern.id.substring(0, 8).toUpperCase()}`;
      const updatedIntern = await tx.intern.update({
        where: { id: intern.id },
        data: { internCode: generatedCode },
        select: { id: true, internCode: true },
      });

      return {
        application,
        user,
        intern: updatedIntern,
      };
    });
  }

  reject(
    id: string,
    rejecterId: string,
    rejectedReason: string,
  ): Promise<ApplicationDto> {
    return prisma.application.update({
      where: { id },
      data: {
        status: APPLICATION_STATUS.REJECTED,
        rejectedBy: rejecterId,
        rejectedAt: new Date(),
        rejectedReason,
      },
      select: applicationSelect,
    });
  }

  softDelete(id: string): Promise<ApplicationDto> {
    return prisma.application.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: applicationSelect,
    });
  }

  async getStats(): Promise<{
    activeInvites: number;
    pendingApplications: number;
    approvedApplications: number;
    rejectedApplications: number;
  }> {
    const [
      activeInvites,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
    ] = await Promise.all([
      prisma.applicationInvite.count({
        where: {
          status: { in: [APPLICATION_INVITE_STATUS.UNUSED, APPLICATION_INVITE_STATUS.ACTIVE] },
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.application.count({
        where: { status: APPLICATION_STATUS.PENDING, deletedAt: null },
      }),
      prisma.application.count({
        where: { status: APPLICATION_STATUS.APPROVED, deletedAt: null },
      }),
      prisma.application.count({
        where: { status: APPLICATION_STATUS.REJECTED, deletedAt: null },
      }),
    ]);

    return {
      activeInvites,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
    };
  }

  createAuditLog(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Prisma.BatchPayload | unknown> {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}
