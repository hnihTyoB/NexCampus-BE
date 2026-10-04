import { Prisma, AssignmentStatus, ExtensionRequestStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  TaskAssignmentQueryDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
  QueryExtensionRequestsDto,
} from "./task-assignment.dto";
import { activityLogRepository } from "../activity-logs/activity-log.repository";

const extensionRequestSelect = {
  id: true,
  assignmentId: true,
  userId: true,
  currentDeadline: true,
  proposedDeadline: true,
  extensionDays: true,
  reason: true,
  commitmentPlan: true,
  status: true,
  rejectionReason: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      internshipProfile: {
        select: {
          id: true,
          internCode: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
  },
  reviewer: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  assignment: {
    select: {
      id: true,
      taskId: true,
      status: true,
      task: {
        select: {
          id: true,
          code: true,
          title: true,
          deadline: true,
        },
      },
    },
  },
};

const defaultSelect = {
  id: true,
  taskId: true,
  assigneeId: true,
  assignedBy: true,
  supportId: true,
  status: true,
  blockedReason: true,
  startedAt: true,
  completedAt: true,
  assignedAt: true,
  updatedAt: true,
  task: {
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      deadline: true,
      estDays: true,
      priority: true,
      createdBy: true,
      taskGroupId: true,
      createdAt: true,
      taskGroup: {
        select: { id: true, name: true, departmentId: true },
      },
      dependsOn: {
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          title: true,
          assignment: {
            select: {
              id: true,
              status: true,
              assignee: { select: { id: true, fullName: true } },
            },
          },
        },
      },
      dependencies: {
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          title: true,
          assignment: {
            select: {
              id: true,
              status: true,
              assignee: { select: { id: true, fullName: true } },
            },
          },
        },
      },
    },
  },
  assignee: {
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      avatarUrl: true,
      isActive: true,
      internshipProfile: {
        select: {
          id: true,
          internCode: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
          mentorId: true,
          status: true,
          startDate: true,
          duration: true,
        },
      },
    },
  },
  assigner: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  support: {
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      avatarUrl: true,
      isActive: true,
    },
  },
  extensionRequests: {
    select: {
      id: true,
      currentDeadline: true,
      proposedDeadline: true,
      extensionDays: true,
      reason: true,
      commitmentPlan: true,
      status: true,
      rejectionReason: true,
      reviewedBy: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
};

export class TaskAssignmentRepository {
  /**
   * Helper mapping defaultSelect results to provide backward-compatible `intern` and `internId`
   */
  private mapAssignmentCompat<T extends Record<string, any>>(assignment: T): T & { internId: string; intern: any; support: any };
  private mapAssignmentCompat<T extends Record<string, any>>(assignment: null): null;
  private mapAssignmentCompat<T extends Record<string, any>>(assignment: T | null): (T & { internId: string; intern: any; support: any }) | null;
  private mapAssignmentCompat<T extends Record<string, any>>(assignment: T | null): (T & { internId: string; intern: any; support: any }) | null {
    if (!assignment) return null;
    const assignee = assignment.assignee;
    const intern = assignee
      ? {
          id: assignee.internshipProfile?.id || assignee.id,
          userId: assignee.id,
          leaderId: assignee.internshipProfile?.mentorId || null,
          fullName: assignee.fullName || "",
          phone: assignee.phoneNumber || "",
          department: assignee.internshipProfile?.department || null,
          position: assignee.internshipProfile?.position || null,
          startDate: assignee.internshipProfile?.startDate || null,
          duration: assignee.internshipProfile?.duration || null,
          status: assignee.internshipProfile?.status || "ACTIVE",
          user: {
            id: assignee.id,
            email: assignee.email,
            fullName: assignee.fullName,
          },
        }
      : null;

    const support = assignment.support
      ? {
          id: assignment.support.id,
          userId: assignment.support.id,
          fullName: assignment.support.fullName || "",
          status: assignment.support.isActive ? "ACTIVE" : "INACTIVE",
          user: {
            id: assignment.support.id,
            email: assignment.support.email,
            fullName: assignment.support.fullName,
          },
        }
      : null;

    return {
      ...assignment,
      internId: assignment.assigneeId,
      intern,
      support,
    };
  }

  async findAll(
    query: TaskAssignmentQueryDto,
    scope?: {
      userId?: string;
      internId?: string; // backwards compatibility alias for userId
      departmentIds?: string[];
      leaderUserId?: string;
    },
  ) {
    const {
      taskId,
      assigneeId,
      internId,
      assignedBy,
      leaderId,
      status,
      role,
      sortBy = "assignedAt",
      order = "desc",
      page = 1,
      limit = 20,
    } = query;

    const targetUserId = assigneeId || internId;
    const scopedUserId = scope?.userId || scope?.internId;

    const where: Prisma.TaskAssignmentWhereInput = {
      task: { deletedAt: null },
      ...(taskId ? { taskId } : {}),
      ...(targetUserId ? { assigneeId: targetUserId } : {}),
      ...(assignedBy ? { assignedBy } : {}),
      ...(status ? { status } : {}),
      ...(leaderId
        ? {
            assignee: {
              internshipProfile: { mentorId: leaderId },
            },
          }
        : {}),
      ...(scopedUserId !== undefined
        ? role === "OWNER"
          ? { assigneeId: scopedUserId }
          : role === "SUPPORT"
            ? { supportId: scopedUserId }
            : {
                OR: [
                  { assigneeId: scopedUserId },
                  { supportId: scopedUserId },
                ],
              }
        : {}),
      ...(scope?.departmentIds !== undefined && scope?.leaderUserId !== undefined
        ? {
            OR: [
              { assignedBy: scope.leaderUserId },
              { assignee: { internshipProfile: { mentorId: scope.leaderUserId } } },
              { task: { taskGroup: { departmentId: { in: scope.departmentIds } } } },
              { assignee: { internshipProfile: { departmentId: { in: scope.departmentIds } } } },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.taskAssignment.findMany({
        where,
        select: defaultSelect,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.taskAssignment.count({ where }),
    ]);

    return {
      data: data.map((item) => this.mapAssignmentCompat(item)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const assignment = await prisma.taskAssignment.findUnique({
      where: { id },
      select: defaultSelect,
    });
    return this.mapAssignmentCompat(assignment);
  }

  async findByTaskId(taskId: string) {
    const assignment = await prisma.taskAssignment.findUnique({
      where: { taskId },
      select: defaultSelect,
    });
    return this.mapAssignmentCompat(assignment);
  }

  async create(data: CreateTaskAssignmentDto, assignedBy: string, status: AssignmentStatus) {
    const assigneeId = data.assigneeId || data.internId;
    const assignment = await prisma.taskAssignment.create({
      data: {
        taskId: data.taskId,
        assigneeId: assigneeId!,
        supportId: data.supportId || null,
        assignedBy,
        status,
      },
      select: defaultSelect,
    });
    return this.mapAssignmentCompat(assignment);
  }

  async update(id: string, data: UpdateTaskAssignmentDto) {
    const assigneeId = data.assigneeId || data.internId;
    const assignment = await prisma.taskAssignment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.blockedReason !== undefined ? { blockedReason: data.blockedReason } : {}),
        ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
        ...(assigneeId !== undefined ? { assigneeId } : {}),
        ...(data.supportId !== undefined ? { supportId: data.supportId } : {}),
      },
      select: defaultSelect,
    });
    return this.mapAssignmentCompat(assignment);
  }

  delete(id: string) {
    return prisma.taskAssignment.delete({
      where: { id },
    });
  }

  // ─── Task Extension Request Methods ──────────────────────────────────────────

  async createExtensionRequest(data: {
    assignmentId: string;
    userId?: string;
    internId?: string;
    currentDeadline: Date;
    proposedDeadline: Date;
    extensionDays: number;
    reason: string;
    commitmentPlan: string;
  }) {
    const userId = data.userId || data.internId;
    const request = await prisma.taskExtensionRequest.create({
      data: {
        assignmentId: data.assignmentId,
        userId: userId!,
        currentDeadline: data.currentDeadline,
        proposedDeadline: data.proposedDeadline,
        extensionDays: data.extensionDays,
        reason: data.reason,
        commitmentPlan: data.commitmentPlan,
        status: ExtensionRequestStatus.PENDING,
      },
      select: extensionRequestSelect,
    });

    return {
      ...request,
      internId: request.userId,
      intern: request.user
        ? {
            id: request.user.internshipProfile?.id || request.user.id,
            fullName: request.user.fullName || "",
            internCode: request.user.internshipProfile?.internCode || null,
            user: { id: request.user.id, email: request.user.email },
            department: request.user.internshipProfile?.department || null,
          }
        : undefined,
    };
  }

  async findExtensionRequestById(id: string) {
    const request = await prisma.taskExtensionRequest.findUnique({
      where: { id },
      select: extensionRequestSelect,
    });
    if (!request) return null;
    return {
      ...request,
      internId: request.userId,
      intern: request.user
        ? {
            id: request.user.internshipProfile?.id || request.user.id,
            fullName: request.user.fullName || "",
            internCode: request.user.internshipProfile?.internCode || null,
            user: { id: request.user.id, email: request.user.email },
            department: request.user.internshipProfile?.department || null,
          }
        : undefined,
    };
  }

  async findPendingExtensionRequestByAssignmentId(assignmentId: string) {
    const request = await prisma.taskExtensionRequest.findFirst({
      where: {
        assignmentId,
        status: ExtensionRequestStatus.PENDING,
      },
      select: extensionRequestSelect,
      orderBy: { createdAt: "desc" },
    });
    if (!request) return null;
    return {
      ...request,
      internId: request.userId,
      intern: request.user
        ? {
            id: request.user.internshipProfile?.id || request.user.id,
            fullName: request.user.fullName || "",
            internCode: request.user.internshipProfile?.internCode || null,
            user: { id: request.user.id, email: request.user.email },
            department: request.user.internshipProfile?.department || null,
          }
        : undefined,
    };
  }

  async findExtensionRequests(
    query: QueryExtensionRequestsDto,
    scope?: {
      userId?: string;
      internId?: string;
      departmentIds?: string[];
      leaderUserId?: string;
    },
  ) {
    const { status, userId, internId, assignmentId, taskId, page = 1, limit = 20 } = query;
    const targetUserId = userId || internId;
    const scopedUserId = scope?.userId || scope?.internId;

    const where: Prisma.TaskExtensionRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(targetUserId ? { userId: targetUserId } : {}),
      ...(assignmentId ? { assignmentId } : {}),
      ...(taskId ? { assignment: { taskId } } : {}),
      ...(scopedUserId !== undefined ? { userId: scopedUserId } : {}),
      ...(scope?.departmentIds !== undefined && scope?.leaderUserId !== undefined
        ? {
            OR: [
              { assignment: { assignedBy: scope.leaderUserId } },
              { user: { internshipProfile: { mentorId: scope.leaderUserId } } },
              {
                assignment: {
                  task: {
                    taskGroup: { departmentId: { in: scope.departmentIds } },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.taskExtensionRequest.findMany({
        where,
        select: extensionRequestSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.taskExtensionRequest.count({ where }),
    ]);

    return {
      data: data.map((req) => ({
        ...req,
        internId: req.userId,
        intern: req.user
          ? {
              id: req.user.internshipProfile?.id || req.user.id,
              fullName: req.user.fullName || "",
              internCode: req.user.internshipProfile?.internCode || null,
              user: { id: req.user.id, email: req.user.email },
              department: req.user.internshipProfile?.department || null,
            }
          : undefined,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  updateExtensionRequestStatus(
    id: string,
    data: {
      status: ExtensionRequestStatus;
      rejectionReason?: string;
      reviewedBy: string;
      reviewedAt: Date;
    },
  ) {
    return prisma.taskExtensionRequest.update({
      where: { id },
      data: {
        status: data.status,
        rejectionReason: data.rejectionReason,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt,
      },
      select: extensionRequestSelect,
    });
  }

  countExtensionsOnTask(assignmentId: string): Promise<number> {
    return prisma.taskExtensionRequest.count({
      where: {
        assignmentId,
        status: ExtensionRequestStatus.APPROVED,
      },
    });
  }

  countExtensionsByUserId(userId: string): Promise<number> {
    return prisma.taskExtensionRequest.count({
      where: {
        userId,
        status: ExtensionRequestStatus.APPROVED,
      },
    });
  }

  countExtensionsByInternId(internId: string): Promise<number> {
    return this.countExtensionsByUserId(internId);
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

  async findUserById(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        discordUsername: true,
        discordUserId: true,
        role: {
          select: {
            name: true,
            portalType: true,
          },
        },
        internshipProfile: {
          include: { department: true, mentor: true },
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
        department: { select: { id: true, name: true } },
      },
    });
  }

  async findInternshipProfileById(profileId: string) {
    return prisma.internshipProfile.findUnique({
      where: { id: profileId },
      select: { userId: true },
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
      where: { mentorId },
      select: { userId: true },
    });
    return records.map((r) => r.userId);
  }

  async isTaskGroupMember(taskGroupId: string, userId: string): Promise<boolean> {
    const member = await prisma.taskGroupMember.findUnique({
      where: {
        taskGroupId_userId: { taskGroupId, userId },
      },
      select: { userId: true },
    });
    return !!member;
  }

  async findTaskById(taskId: string) {
    return prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        deadline: true,
        phase: true,
        priority: true,
        estDays: true,
        taskGroupId: true,
        taskGroup: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            maxWorkloadDays: true,
            maxActiveTasks: true,
          },
        },
        dependsOn: {
          select: { id: true, title: true, code: true },
        },
      },
    });
  }

  async findActiveAssignmentsForUser(
    userId: string,
    statuses: readonly string[],
    excludeAssignmentId?: string,
  ) {
    return prisma.taskAssignment.findMany({
      where: {
        ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
        status: { in: statuses as any },
        task: { deletedAt: null },
        OR: [{ assigneeId: userId }, { supportId: userId }],
      },
      select: {
        assigneeId: true,
        supportId: true,
        status: true,
        task: {
          select: {
            id: true,
            title: true,
            estDays: true,
          },
        },
      },
    });
  }

  async findIncompleteDependencyAssignments(dependencyTaskIds: string[]) {
    return prisma.taskAssignment.findMany({
      where: {
        taskId: { in: dependencyTaskIds },
        status: { not: AssignmentStatus.DONE },
      },
      select: {
        taskId: true,
        status: true,
        task: { select: { title: true, code: true } },
      },
    });
  }

  async approveExtensionInTransaction(params: {
    requestId: string;
    assignmentId: string;
    taskId: string;
    proposedDeadline: Date;
    actorId: string;
    oldDeadline?: Date;
    extensionDays?: number;
    ipAddress?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const updatedReq = await tx.taskExtensionRequest.update({
        where: { id: params.requestId },
        data: {
          status: ExtensionRequestStatus.APPROVED,
          reviewedBy: params.actorId,
          reviewedAt: new Date(),
        },
        select: extensionRequestSelect,
      });

      await tx.task.update({
        where: { id: params.taskId },
        data: { deadline: params.proposedDeadline },
      });

      await tx.taskAssignment.update({
        where: { id: params.assignmentId },
        data: { status: AssignmentStatus.IN_PROGRESS },
      });

      await activityLogRepository.create({
        actorId: params.actorId,
        action: "APPROVE_TASK_EXTENSION",
        targetType: "TASK_EXTENSION_REQUEST",
        targetId: params.requestId,
        details: {
          assignmentId: params.assignmentId,
          taskId: params.taskId,
          oldDeadline: params.oldDeadline,
          newDeadline: params.proposedDeadline,
          extensionDays: params.extensionDays,
        },
        ipAddress: params.ipAddress,
      });

      return updatedReq;
    });
  }

  async rejectExtensionInTransaction(params: {
    requestId: string;
    assignmentId: string;
    taskId?: string;
    reason: string;
    actorId: string;
    ipAddress?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const updatedReq = await tx.taskExtensionRequest.update({
        where: { id: params.requestId },
        data: {
          status: ExtensionRequestStatus.REJECTED,
          rejectionReason: params.reason,
          reviewedBy: params.actorId,
          reviewedAt: new Date(),
        },
        select: extensionRequestSelect,
      });

      await tx.taskAssignment.update({
        where: { id: params.assignmentId },
        data: { status: AssignmentStatus.IN_PROGRESS },
      });

      await activityLogRepository.create({
        actorId: params.actorId,
        action: "REJECT_TASK_EXTENSION",
        targetType: "TASK_EXTENSION_REQUEST",
        targetId: params.requestId,
        details: {
          assignmentId: params.assignmentId,
          taskId: params.taskId,
          rejectionReason: params.reason,
        },
        ipAddress: params.ipAddress,
      });

      return updatedReq;
    });
  }
}

export const taskAssignmentRepository = new TaskAssignmentRepository();
