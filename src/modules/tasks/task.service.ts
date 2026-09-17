import { TaskRepository } from "./task.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  TaskQueryDto,
  CreateTaskDto,
  UpdateTaskDto,
  ConfirmAttachmentUploadDto,
  CreateLinkAttachmentDto,
} from "./task.dto";
import { ASSIGNMENT_STATUS } from "../../common/constants/task.constant";
import { ROLES } from "../../common/constants/role.constant";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { R2Service } from "../../common/services/r2.service";
import { prisma } from "../../database/prisma.client";
import { taskAllocationAiService } from "./task-allocation.ai.service";
import crypto from "crypto";

interface UserPayload {
  id: string;
  email?: string | null;
  role?: string;
}

export class TaskService {
  private readonly repository = new TaskRepository();
  private readonly r2Service = new R2Service();

  private validateSchedule(
    startDate: string | Date | null | undefined,
    deadline: string | Date,
  ) {
    if (!startDate) return;

    if (new Date(startDate).getTime() > new Date(deadline).getTime()) {
      throw new AppError(
        "Start date must be on or before deadline",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }
  }

  async findEditableTask(taskId: string) {
    const task = await this.repository.findById(taskId);
    if (!task) {
      throw new AppError("Task not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (task.assignment?.status === ASSIGNMENT_STATUS.DONE) {
      throw new AppError(
        "Completed tasks cannot be edited",
        409,
        ERROR_CODE.TASK_ALREADY_COMPLETED,
      );
    }

    return task;
  }

  async findAll(query: TaskQueryDto, user?: UserPayload) {
    if (user?.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!intern) {
        throw new AppError("Intern profile not found", 404, ERROR_CODE.NOT_FOUND);
      }
      return this.repository.findAll(query, { internId: intern.id });
    }

    if (user?.role === ROLES.LEADER) {
      const leader = await prisma.leader.findFirst({
        where: { userId: user.id },
        select: { departments: { select: { departmentId: true } } },
      });
      const departmentIds = leader?.departments.map((d) => d.departmentId) ?? [];
      return this.repository.findAll(query, { departmentIds });
    }

    return this.repository.findAll(query);
  }

  async findById(id: string, user?: UserPayload) {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new AppError("Task not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (user?.role === ROLES.INTERN) {
      const intern = await prisma.intern.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      const isOwner = task.assignment?.internId === intern?.id;
      const isSupport = task.assignment?.supportId === intern?.id;
      if (!isOwner && !isSupport) {
        throw new AppError(
          "You are not authorized to view this task",
          403,
          ERROR_CODE.FORBIDDEN,
        );
      }
    }

    return task;
  }

  async create(
    data: CreateTaskDto,
    createdBy: string,
    context?: { ipAddress?: string },
  ) {
    this.validateSchedule(data.startDate, data.deadline);

    if (data.code && data.taskGroupId) {
      const existing = await this.repository.findByCode(data.code, data.taskGroupId);
      if (existing) {
        throw new AppError(
          `Mã công việc "${data.code}" đã tồn tại trong nhóm này`,
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
    }

    const result = await this.repository.create(data, createdBy);

    await this.repository.createAuditLog({
      actorId: createdBy,
      action: AUDIT_ACTION.CREATE_TASK,
      targetType: AUDIT_TARGET_TYPE.TASK,
      targetId: result.id,
      details: { title: result.title, code: result.code },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async update(
    id: string,
    data: UpdateTaskDto,
    actorId: string,
    context?: { ipAddress?: string },
  ) {
    const current = await this.findEditableTask(id);

    const nextStartDate =
      data.startDate === undefined ? current.startDate : data.startDate;
    const nextDeadline =
      data.deadline === undefined ? current.deadline : data.deadline;
    this.validateSchedule(nextStartDate, nextDeadline);

    if (data.code && (data.code !== current.code || data.taskGroupId !== undefined)) {
      const targetGroup =
        data.taskGroupId !== undefined ? data.taskGroupId : current.taskGroupId;
      const existing = await this.repository.findByCode(data.code, targetGroup);
      if (existing && existing.id !== id) {
        throw new AppError(
          `Mã công việc "${data.code}" đã tồn tại trong nhóm này`,
          409,
          ERROR_CODE.DUPLICATE_ENTRY,
        );
      }
    }

    const result = await this.repository.update(id, data);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.UPDATE_TASK,
      targetType: AUDIT_TARGET_TYPE.TASK,
      targetId: result.id,
      details: { title: result.title, code: result.code },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async delete(
    id: string,
    actorId: string,
    context?: { ipAddress?: string },
  ) {
    const task = await this.findEditableTask(id);
    const result = await this.repository.softDelete(id);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_TASK,
      targetType: AUDIT_TARGET_TYPE.TASK,
      targetId: id,
      details: { title: task.title },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  // ─── Attachments ────────────────────────────────────────────────────────────

  async getAttachmentUploadUrl(
    taskId: string,
    fileName: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    await this.findEditableTask(taskId);

    const existing = await this.repository.findAttachmentsByTaskId(taskId);
    if (existing.length >= 10) {
      throw new AppError(
        "Maximum 10 attachments allowed per task",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `tasks/${taskId}/${crypto.randomUUID()}_${safeFileName}`;

    const uploadUrl = await this.r2Service.getPresignedUploadUrl(
      key,
      contentType,
    );
    const publicUrl = this.r2Service.getPublicUrl(key);

    return { uploadUrl, key, publicUrl };
  }

  async confirmAttachment(
    taskId: string,
    data: ConfirmAttachmentUploadDto,
    uploadedBy: string,
    context?: { ipAddress?: string },
  ) {
    await this.findEditableTask(taskId);

    const fileUrl = this.r2Service.getPublicUrl(data.filePath);

    const result = await this.repository.createAttachment(
      taskId,
      data,
      fileUrl,
      uploadedBy,
    );

    await this.repository.createAuditLog({
      actorId: uploadedBy,
      action: AUDIT_ACTION.UPLOAD_TASK_ATTACHMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ATTACHMENT,
      targetId: result.id,
      details: { taskId, fileName: result.fileName },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async createLinkAttachment(
    taskId: string,
    data: CreateLinkAttachmentDto,
    uploadedBy: string,
    context?: { ipAddress?: string },
  ) {
    await this.findEditableTask(taskId);

    const result = await this.repository.createLinkAttachment(
      taskId,
      data,
      uploadedBy,
    );

    await this.repository.createAuditLog({
      actorId: uploadedBy,
      action: AUDIT_ACTION.UPLOAD_TASK_ATTACHMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ATTACHMENT,
      targetId: result.id,
      details: { taskId, fileName: result.fileName, link: result.fileUrl },
      ipAddress: context?.ipAddress,
    });

    return result;
  }

  async deleteAttachment(
    taskId: string,
    attachmentId: string,
    actorId: string,
    actorRole?: string,
    context?: { ipAddress?: string },
  ) {
    await this.findEditableTask(taskId);

    const attachment = await this.repository.findAttachmentById(attachmentId);
    if (!attachment || attachment.taskId !== taskId) {
      throw new AppError("Attachment not found", 404, ERROR_CODE.NOT_FOUND);
    }

    if (actorRole !== ROLES.ADMIN && attachment.uploadedBy !== actorId) {
      throw new AppError(
        "Bạn không có quyền xóa tệp đính kèm này",
        403,
        ERROR_CODE.FORBIDDEN,
      );
    }

    const isLink =
      attachment.filePath.startsWith("http://") ||
      attachment.filePath.startsWith("https://");
    if (!isLink) {
      await this.r2Service.deleteFile(attachment.filePath).catch((err) => {
        console.warn(`[TaskService] Failed to delete R2 object ${attachment.filePath}:`, err);
      });
    }

    await this.repository.deleteAttachment(attachmentId);

    await this.repository.createAuditLog({
      actorId,
      action: AUDIT_ACTION.DELETE_TASK_ATTACHMENT,
      targetType: AUDIT_TARGET_TYPE.TASK_ATTACHMENT,
      targetId: attachmentId,
      details: { taskId, fileName: attachment.fileName },
      ipAddress: context?.ipAddress,
    });
  }

  async findAttachments(taskId: string, user?: UserPayload) {
    await this.findById(taskId, user);
    return this.repository.findAttachmentsByTaskId(taskId);
  }

  async getAiRecommendation(taskId: string, actor: UserPayload) {
    const task = await this.repository.findById(taskId);
    if (!task) {
      throw new AppError("Task not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const whereIntern: Record<string, unknown> = {
      status: "ACTIVE",
      deletedAt: null,
      user: { isActive: true },
    };

    if (actor.role === ROLES.LEADER) {
      whereIntern.leaderId = actor.id;
    }

    if (task.taskGroup?.departmentId) {
      whereIntern.departmentId = task.taskGroup.departmentId;
    }

    const interns = await prisma.intern.findMany({
      where: whereIntern,
      include: {
        user: { select: { email: true } },
        position: { select: { name: true } },
        assignedTasks: {
          where: {
            status: {
              in: [
                ASSIGNMENT_STATUS.TODO,
                ASSIGNMENT_STATUS.IN_PROGRESS,
                ASSIGNMENT_STATUS.REVIEW,
              ],
            },
          },
          include: {
            task: { select: { estDays: true } },
          },
        },
      },
    });

    if (interns.length === 0) {
      throw new AppError(
        "Không có thực tập sinh phù hợp để đánh giá",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const candidates = interns.map((i) => {
      const activeTaskDays = i.assignedTasks.reduce(
        (acc: number, curr: { task: { estDays: number | null } | null }) =>
          acc + (curr.task?.estDays || 1),
        0,
      );
      return {
        id: i.id,
        fullName: i.fullName || "Thực tập sinh",
        position: i.position ? { name: i.position.name } : undefined,
        activeTaskDays,
      };
    });

    const evaluated = taskAllocationAiService.evaluateAllocation({
      task: {
        title: task.title,
        description: task.description,
        module: task.module,
        priority: task.priority,
        estDays: task.estDays || 1,
        maxWorkloadDays: 10,
        deadline: task.deadline ? task.deadline.toISOString() : undefined,
      },
      candidates,
    });

    const candidateRankings = evaluated.candidateRankings ?? [];
    const evaluatedMap = new Map(
      candidateRankings.map((r) => [r.candidateId, r]),
    );

    const ownerCandidate = candidates.find(
      (c) => c.id === evaluated.recommendedOwnerId,
    );
    const ownerRanking = evaluatedMap.get(evaluated.recommendedOwnerId);

    const supportCandidate = evaluated.recommendedSupportId
      ? candidates.find((c) => c.id === evaluated.recommendedSupportId)
      : null;
    const supportRanking = evaluated.recommendedSupportId
      ? evaluatedMap.get(evaluated.recommendedSupportId)
      : null;

    const allCandidates = candidates.map((c) => {
      const ranking = evaluatedMap.get(c.id);
      const compatibilityScore = ranking?.compatibilityScore ?? 75;
      return {
        id: c.id,
        name: c.fullName,
        position: c.position?.name ?? null,
        compatibilityScore,
        workloadScore: Math.max(0, Math.round(100 - (c.activeTaskDays / 10) * 100)),
        performanceScore: 80,
        skillScore: 75,
        learningScore: 80,
        activeTaskDays: c.activeTaskDays,
        codingScore: null,
      };
    });

    return {
      owner: {
        id: evaluated.recommendedOwnerId,
        name: ownerCandidate?.fullName || "Chưa xác định",
        position: ownerCandidate?.position?.name ?? null,
        compatibilityScore: ownerRanking?.compatibilityScore ?? 85,
        workloadDays: ownerRanking?.estimatedWorkload ?? (task.estDays || 1),
        codingScore: null,
      },
      support: supportCandidate
        ? {
            id: supportCandidate.id,
            name: supportCandidate.fullName,
            position: supportCandidate.position?.name ?? null,
            compatibilityScore: supportRanking?.compatibilityScore ?? 80,
            workloadDays: supportRanking?.estimatedWorkload ?? 0,
            codingScore: null,
          }
        : null,
      reasons: evaluated.reasons,
      riskLevel: evaluated.riskLevel,
      workloadAnalysis: evaluated.workloadAnalysis,
      learningOpportunity: evaluated.learningOpportunity,
      allCandidates,
      meta: {
        totalEvaluated: candidates.length,
        aiFailed: false,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}
