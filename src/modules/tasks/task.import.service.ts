import * as XLSX from "xlsx";
import { TaskPriority } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import {
  ImportTaskRowDto,
  ImportPreviewDto,
  ImportResultDto,
} from "./task.dto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { createAuditLog } from "../activity-logs/activity-log.service";
import {
  AUDIT_ACTION,
  AUDIT_TARGET_TYPE,
} from "../../common/constants/audit-log.constant";
import { notificationDispatcher } from "../../common/services/notification-dispatcher.service";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TYPE,
} from "../../common/constants/notification.constant";
import { TaskRepository } from "./task.repository";
import {
  TASK_PRIORITY,
  ASSIGNMENT_STATUS,
} from "../../common/constants/task.constant";

const PRIORITY_MAP: Record<string, TaskPriority> = {
  P0: TASK_PRIORITY.HIGH as TaskPriority,
  P1: TASK_PRIORITY.MEDIUM as TaskPriority,
  P2: TASK_PRIORITY.LOW as TaskPriority,
  HIGH: TASK_PRIORITY.HIGH as TaskPriority,
  MEDIUM: TASK_PRIORITY.MEDIUM as TaskPriority,
  LOW: TASK_PRIORITY.LOW as TaskPriority,
};

function parseAssignmentStatus(value: unknown): string {
  if (!value) return ASSIGNMENT_STATUS.TODO;
  const s = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, " ");

  if (
    [
      "to do",
      "todo",
      "chua lam",
      "can lam",
      "chua bat dau",
      "cho lam",
      "moi",
      "new",
    ].includes(s)
  ) {
    return ASSIGNMENT_STATUS.TODO;
  }
  if (
    [
      "in progress",
      "inprogress",
      "dang lam",
      "dang thuc hien",
      "dang xu ly",
      "doing",
    ].includes(s)
  ) {
    return ASSIGNMENT_STATUS.IN_PROGRESS;
  }
  if (
    [
      "review",
      "cho duyet",
      "danh gia",
      "dang danh gia",
      "cho danh gia",
    ].includes(s)
  ) {
    return ASSIGNMENT_STATUS.REVIEW;
  }
  if (
    ["done", "hoan thanh", "da xong", "completed", "finish", "finished"].includes(
      s,
    )
  ) {
    return ASSIGNMENT_STATUS.DONE;
  }
  if (["blocked", "bi chan", "tam dung", "tam hoan"].includes(s)) {
    return ASSIGNMENT_STATUS.BLOCKED;
  }
  if (["pending approval", "pending_approval", "pending"].includes(s)) {
    return ASSIGNMENT_STATUS.PENDING_APPROVAL;
  }
  return ASSIGNMENT_STATUS.TODO;
}

function parseExcelDate(value: unknown): string | undefined {
  if (!value) return undefined;

  // Trường hợp 1: xlsx parse thành JS Date (khi cellDates: true)
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) return value.toISOString();
    return undefined;
  }

  // Trường hợp 2: chuỗi Date
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Excel serial date dạng string số
    if (/^\d+$/.test(trimmed)) {
      const date = XLSX.SSF.parse_date_code(Number(trimmed));
      if (date) {
        const d = new Date(Date.UTC(date.y, date.m - 1, date.d));
        return d.toISOString();
      }
      return undefined;
    }

    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) return direct.toISOString();

    // DD/MM/YYYY
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const d = new Date(
        `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`,
      );
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    return undefined;
  }

  // Trường hợp 3: số serial Excel
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const d = new Date(Date.UTC(date.y, date.m - 1, date.d));
      return d.toISOString();
    }
  }

  return undefined;
}

function parseDependencies(raw: unknown): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseAttachments(raw: unknown): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse sheet "Lists": Đọc mapping Owners alias → Email.
 */
function parseListsSheet(workbook: XLSX.WorkBook): Record<string, string | null> {
  const sheet = workbook.Sheets["Lists"];
  if (!sheet) return {};

  const rows = XLSX.utils.sheet_to_json<{ Owners: string; Email?: string }>(
    sheet,
    { defval: null },
  );

  const mapping: Record<string, string | null> = {};
  for (const row of rows) {
    if (row.Owners) {
      const alias = String(row.Owners).trim();
      const email = row.Email ? String(row.Email).trim().toLowerCase() : null;
      mapping[alias] = email;
    }
  }

  return mapping;
}

function parseTaskSheet(
  workbook: XLSX.WorkBook,
  ownerEmailMap: Record<string, string | null>,
): {
  validRows: ImportTaskRowDto[];
  errorRows: { rowIndex: number; excelCode?: string; errors: string[] }[];
} {
  const sheet = workbook.Sheets["Task_Phan_Cong"];
  if (!sheet) {
    throw new AppError(
      "Không tìm thấy sheet 'Task_Phan_Cong' trong file Excel",
      400,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const validRows: ImportTaskRowDto[] = [];
  const errorRows: {
    rowIndex: number;
    excelCode?: string;
    errors: string[];
  }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const errors: string[] = [];
    const excelCode = row["Task ID"] ? String(row["Task ID"]).trim() : undefined;

    if (!excelCode) errors.push("Thiếu Task ID");
    const rawTask = row["Task"];
    if (!rawTask) errors.push("Thiếu tên Task");

    const rawDue = row["Due"];
    const deadline = parseExcelDate(rawDue);
    if (!deadline) errors.push(`Không parse được ngày Due: "${rawDue}"`);

    const rawPriority = row["Priority"] ? String(row["Priority"]).trim() : null;
    const priority = rawPriority ? PRIORITY_MAP[rawPriority.toUpperCase()] : null;
    if (!priority)
      errors.push(
        `Priority không hợp lệ: "${rawPriority}" (cho phép: P0, P1, P2 hoặc HIGH, MEDIUM, LOW)`,
      );

    const rawStart =
      row["Start"] && String(row["Start"]).trim()
        ? String(row["Start"]).trim()
        : null;
    let startDate: string | undefined;
    if (rawStart) {
      startDate = parseExcelDate(rawStart);
      if (!startDate) errors.push(`Không parse được ngày Start: "${rawStart}"`);
    }

    const rawOwner =
      row["Owner"] && String(row["Owner"]).trim()
        ? String(row["Owner"]).trim()
        : null;
    let ownerEmail: string | undefined;
    if (rawOwner) {
      if (rawOwner in ownerEmailMap) {
        ownerEmail = ownerEmailMap[rawOwner] ?? undefined;
      } else {
        ownerEmail = rawOwner.includes("@") ? rawOwner.toLowerCase() : undefined;
      }
    }

    const rawSupport =
      row["Support"] && String(row["Support"]).trim()
        ? String(row["Support"]).trim()
        : null;
    let supportEmail: string | undefined;
    if (rawSupport) {
      if (rawSupport in ownerEmailMap) {
        supportEmail = ownerEmailMap[rawSupport] ?? undefined;
      } else {
        supportEmail = rawSupport.includes("@")
          ? rawSupport.toLowerCase()
          : undefined;
      }
    }

    if (supportEmail && !ownerEmail) {
      errors.push(
        "Không thể chỉ định Intern hỗ trợ nếu thiếu người chịu trách nhiệm chính (Owner)",
      );
    }

    const rawStatus =
      row["Status"] ??
      row["status"] ??
      row["Trạng thái"] ??
      row["trạng thái"] ??
      row["Trang thai"] ??
      "To Do";
    const mappedStatus = parseAssignmentStatus(rawStatus);

    if (errors.length > 0) {
      errorRows.push({ rowIndex: i + 2, excelCode, errors });
      continue;
    }

    const rawEstDays = row["Est Days"];
    let estDays: number | undefined;
    if (rawEstDays != null) {
      estDays = Number(rawEstDays);
      if (isNaN(estDays)) {
        errors.push(`Est Days phải là số hợp lệ: "${rawEstDays}"`);
      }
    }

    validRows.push({
      excelCode: excelCode!,
      title: String(rawTask).trim(),
      description: row["Mô tả"] ? String(row["Mô tả"]).trim() : "",
      deadline: deadline!,
      startDate,
      priority: priority!,
      ownerEmail,
      supportEmail,
      phase: row["Giai đoạn"] ? String(row["Giai đoạn"]).trim() : undefined,
      module: row["Module"] ? String(row["Module"]).trim() : undefined,
      estDays,
      acceptanceCriteria: row["Acceptance Criteria"]
        ? String(row["Acceptance Criteria"]).trim()
        : undefined,
      taskNotes: row["Notes"] ? String(row["Notes"]).trim() : undefined,
      dependencyCodes: parseDependencies(row["Dependency"]),
      attachmentUrls: parseAttachments(row["Attachments"]),
      _status: mappedStatus,
    } as ImportTaskRowDto & { _status?: string });
  }

  return { validRows, errorRows };
}

export class TaskImportService {
  private readonly taskRepo = new TaskRepository();

  private sanitizeTaskGroupId(taskGroupId?: string): string | undefined {
    if (!taskGroupId) return undefined;
    const trimmed = taskGroupId.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") {
      return undefined;
    }
    const isUuid =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        trimmed,
      );
    if (!isUuid) {
      throw new AppError(
        "ID Nhóm công việc không hợp lệ (yêu cầu định dạng UUID)",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }
    return trimmed;
  }

  private generateDefaultGroupName(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Nhóm công việc ${dateStr} ${timeStr}`;
  }

  async preview(
    buffer: Buffer,
    taskGroupId?: string,
    taskGroupName?: string,
  ): Promise<ImportPreviewDto> {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    let resolvedGroupId: string | undefined;
    let resolvedGroupName: string | undefined;

    const cleanGroupId = this.sanitizeTaskGroupId(taskGroupId);

    if (cleanGroupId) {
      const tg = await prisma.taskGroup.findUnique({
        where: { id: cleanGroupId },
      });
      if (!tg) {
        throw new AppError(
          "Không tìm thấy Nhóm công việc với ID đã cung cấp",
          404,
          ERROR_CODE.NOT_FOUND,
        );
      }
      resolvedGroupId = tg.id;
      resolvedGroupName = tg.name;
    } else {
      const name =
        (taskGroupName && taskGroupName.trim()) ||
        this.generateDefaultGroupName();
      const tg = await prisma.taskGroup.findFirst({
        where: { name },
      });
      resolvedGroupId = tg?.id;
      resolvedGroupName = name;
    }

    const ownerEmailMap = parseListsSheet(workbook);
    const { validRows, errorRows } = parseTaskSheet(workbook, ownerEmailMap);

    const uniqueEmails = [
      ...new Set(
        validRows
          .flatMap((r) => [r.ownerEmail, r.supportEmail])
          .filter((e): e is string => !!e),
      ),
    ];

    const matchingInterns =
      uniqueEmails.length > 0
        ? await prisma.intern.findMany({
            where: {
              deletedAt: null,
              user: { email: { in: uniqueEmails, mode: "insensitive" } },
            },
            select: {
              id: true,
              fullName: true,
              user: { select: { email: true } },
            },
          })
        : [];

    const internByEmailMap = new Map(
      matchingInterns.map((i) => [i.user.email?.toLowerCase() ?? "", i]),
    );

    const internMappings = Object.entries(ownerEmailMap)
      .filter(([, email]) => email !== null)
      .map(([alias, email]) => {
        const intern = internByEmailMap.get((email as string).toLowerCase());
        return {
          ownerAlias: alias,
          email: email as string,
          internId: intern?.id ?? null,
          internFullName: intern?.fullName ?? null,
        };
      });

    return {
      totalRows: validRows.length + errorRows.length,
      validRows,
      errorRows,
      internMappings,
      taskGroupId: resolvedGroupId,
      taskGroupName: resolvedGroupName,
    };
  }

  async execute(
    buffer: Buffer,
    createdBy: string,
    taskGroupId?: string,
    taskGroupName?: string,
  ): Promise<ImportResultDto> {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const ownerEmailMap = parseListsSheet(workbook);
    const { validRows, errorRows } = parseTaskSheet(workbook, ownerEmailMap);

    if (errorRows.length > 0) {
      const errorDetails = errorRows
        .map(
          (r) =>
            `Dòng ${r.rowIndex}${r.excelCode ? ` (Mã: ${r.excelCode})` : ""}: ${r.errors.join("; ")}`,
        )
        .join("\n");
      throw new AppError(
        `File Excel chứa lỗi định dạng dữ liệu. Vui lòng sửa lại các dòng sau trước khi import:\n${errorDetails}`,
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    if (validRows.length === 0) {
      throw new AppError(
        "Không tìm thấy dòng dữ liệu hợp lệ nào trong file Excel",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const allEmails = [
      ...new Set(
        validRows
          .flatMap((r) => [r.ownerEmail, r.supportEmail])
          .filter((e): e is string => !!e),
      ),
    ];

    const internsByEmail =
      allEmails.length > 0
        ? await prisma.intern.findMany({
            where: {
              deletedAt: null,
              user: { email: { in: allEmails, mode: "insensitive" } },
            },
            select: {
              id: true,
              fullName: true,
              userId: true,
              user: { select: { email: true } },
            },
          })
        : [];

    const internsByEmailMap = new Map(
      internsByEmail.map((i) => [i.user.email?.toLowerCase() ?? "", i]),
    );

    let importedTasks = 0;
    let importedAssignments = 0;
    let importedDependencies = 0;
    const skippedCodes: string[] = [];
    const importErrors: { excelCode?: string; error: string }[] = [];
    const notificationsToDispatch: {
      userId: string;
      taskTitle: string;
      deadline: string;
    }[] = [];

    let resolvedGroupId = "";
    let resolvedGroupName = "";

    const cleanGroupId = this.sanitizeTaskGroupId(taskGroupId);

    const codeToDbId = new Map<string, string>();
    const titleToDbId = new Map<string, string>();

    await prisma.$transaction(
      async (tx) => {
        if (cleanGroupId) {
          const tg = await tx.taskGroup.findUnique({
            where: { id: cleanGroupId },
          });
          if (!tg) {
            throw new AppError(
              "Không tìm thấy Nhóm công việc với ID đã cung cấp",
              404,
              ERROR_CODE.NOT_FOUND,
            );
          }
          resolvedGroupId = tg.id;
          resolvedGroupName = tg.name;
        } else {
          // Gắn nhóm công việc vào Department của Leader để Leader nhìn thấy được nhóm
          const leader = await tx.leader.findFirst({
            where: { userId: createdBy },
            select: { departments: { select: { departmentId: true } } },
          });
          const departmentId = leader?.departments?.[0]?.departmentId ?? null;

          const name =
            (taskGroupName && taskGroupName.trim()) ||
            this.generateDefaultGroupName();

          let tg = await tx.taskGroup.findFirst({
            where: { name, departmentId },
          });
          if (!tg) {
            tg = await tx.taskGroup.create({
              data: {
                name,
                departmentId,
                status: "ACTIVE",
              },
            });
          }
          resolvedGroupId = tg.id;
          resolvedGroupName = tg.name;
        }

        // Tự động thêm các intern tham gia vào TaskGroupMember để cả Leader và Intern đều có quyền xem
        const internIdsInImport = Array.from(
          new Set(
            Array.from(internsByEmailMap.values()).map((i) => i.id),
          ),
        );
        if (internIdsInImport.length > 0) {
          const existingMembers = await tx.taskGroupMember.findMany({
            where: {
              taskGroupId: resolvedGroupId,
              internId: { in: internIdsInImport },
            },
            select: { internId: true },
          });
          const existingMemberSet = new Set(
            existingMembers.map((m) => m.internId),
          );
          const newMembers = internIdsInImport
            .filter((id) => !existingMemberSet.has(id))
            .map((internId) => ({
              taskGroupId: resolvedGroupId,
              internId,
            }));
          if (newMembers.length > 0) {
            await tx.taskGroupMember.createMany({
              data: newMembers,
              skipDuplicates: true,
            });
          }
        }

        // BATCH PRELOAD: Lấy toàn bộ task hiện có trong nhóm vào RAM để loại bỏ 100% queries tuần tự
        const existingTasksInDb = await tx.task.findMany({
          where: { taskGroupId: resolvedGroupId, deletedAt: null },
          select: {
            id: true,
            code: true,
            title: true,
            assignment: { select: { id: true, status: true } },
          },
        });

        const existingByCode = new Map<string, typeof existingTasksInDb[0]>();
        const existingByTitle = new Map<string, typeof existingTasksInDb[0]>();
        for (const t of existingTasksInDb) {
          if (t.code) existingByCode.set(t.code.trim().toUpperCase(), t);
          existingByTitle.set(t.title.trim().toLowerCase(), t);
          codeToDbId.set(t.code ?? "", t.id);
          titleToDbId.set(t.title.trim().toLowerCase(), t.id);
        }

        for (const row of validRows) {
          try {
            const existingTask =
              existingByCode.get(row.excelCode.trim().toUpperCase()) ||
              existingByTitle.get(row.title.trim().toLowerCase());

            let taskId: string;

            if (existingTask) {
              const updated = await tx.task.update({
                where: { id: existingTask.id },
                data: {
                  title: row.title,
                  description: row.description || null,
                  deadline: new Date(row.deadline),
                  startDate: row.startDate ? new Date(row.startDate) : null,
                  estDays: row.estDays ?? null,
                  phase: row.phase ?? null,
                  module: row.module ?? null,
                  acceptanceCriteria: row.acceptanceCriteria ?? null,
                  taskNotes: row.taskNotes ?? null,
                  priority: row.priority,
                },
                select: { id: true },
              });
              taskId = updated.id;
              skippedCodes.push(row.excelCode);
            } else {
              const created = await tx.task.create({
                data: {
                  code: row.excelCode,
                  title: row.title,
                  description: row.description || null,
                  deadline: new Date(row.deadline),
                  startDate: row.startDate ? new Date(row.startDate) : null,
                  estDays: row.estDays ?? 1,
                  phase: row.phase ?? null,
                  module: row.module ?? null,
                  acceptanceCriteria: row.acceptanceCriteria ?? null,
                  taskNotes: row.taskNotes ?? null,
                  priority: row.priority,
                  taskGroupId: resolvedGroupId,
                  createdBy,
                },
                select: { id: true },
              });
              taskId = created.id;
              importedTasks++;
            }

            codeToDbId.set(row.excelCode, taskId);
            titleToDbId.set(row.title.toLowerCase().trim(), taskId);

            let ownerInternId: string | null = null;
            if (row.ownerEmail) {
              const ownerIntern = internsByEmailMap.get(
                row.ownerEmail.toLowerCase(),
              );
              if (ownerIntern) {
                ownerInternId = ownerIntern.id;
              }
            }

            let supportInternId: string | null = null;
            if (row.supportEmail) {
              const supportIntern = internsByEmailMap.get(
                row.supportEmail.toLowerCase(),
              );
              if (supportIntern) {
                supportInternId = supportIntern.id;
              }
            }

            const existingAssignment = existingTask?.assignment;
            const rowWithStatus = row as ImportTaskRowDto & { _status?: string };
            const targetStatus = (rowWithStatus._status || ASSIGNMENT_STATUS.TODO) as any;

            if (existingAssignment) {
              await tx.taskAssignment.update({
                where: { id: existingAssignment.id },
                data: {
                  internId: ownerInternId,
                  supportId: supportInternId,
                  status: targetStatus,
                },
              });
            } else {
              await tx.taskAssignment.create({
                data: {
                  taskId,
                  internId: ownerInternId,
                  supportId: supportInternId,
                  assignedBy: createdBy,
                  status: targetStatus,
                },
              });
              importedAssignments++;

              if (
                ownerInternId &&
                row.ownerEmail &&
                targetStatus === ASSIGNMENT_STATUS.TODO
              ) {
                const ownerIntern = internsByEmailMap.get(
                  row.ownerEmail.toLowerCase(),
                );
                if (ownerIntern) {
                  notificationsToDispatch.push({
                    userId: ownerIntern.userId,
                    taskTitle: row.title,
                    deadline: new Date(row.deadline).toLocaleDateString("vi-VN"),
                  });
                }
              }
            }
          } catch (err) {
            importErrors.push({
              excelCode: row.excelCode,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      },
      { timeout: 60000 },
    );

    // BATCH RESOLVE DEPENDENCIES
    const allDepKeys = new Set<string>();
    for (const row of validRows) {
      row.dependencyCodes.forEach((c) => allDepKeys.add(c.trim()));
    }

    const missingKeys = Array.from(allDepKeys).filter(
      (k) => !codeToDbId.has(k) && !titleToDbId.has(k.toLowerCase()),
    );
    if (missingKeys.length > 0) {
      const dbDepTasks = await prisma.task.findMany({
        where: {
          taskGroupId: resolvedGroupId,
          OR: [
            { code: { in: missingKeys } },
            { title: { in: missingKeys, mode: "insensitive" } },
          ],
          deletedAt: null,
        },
        select: { id: true, code: true, title: true },
      });
      for (const t of dbDepTasks) {
        if (t.code) {
          codeToDbId.set(t.code, t.id);
        }
        titleToDbId.set(t.title.toLowerCase().trim(), t.id);
      }
    }

    for (const row of validRows) {
      if (row.dependencyCodes.length === 0) continue;

      const taskId = codeToDbId.get(row.excelCode);
      if (!taskId) continue;

      const resolvedDepIds = new Set<string>();

      for (const depCode of row.dependencyCodes) {
        const key = depCode.trim();
        const depTaskId =
          codeToDbId.get(key) || titleToDbId.get(key.toLowerCase());

        if (depTaskId) {
          resolvedDepIds.add(depTaskId);
          continue;
        }

        const phaseMatch = key.match(/Phase\s*(\d+)/i);
        if (phaseMatch) {
          const phaseNumStr = phaseMatch[1];
          const phaseRegex = new RegExp(`Phase\\s*${phaseNumStr}`, "i");

          for (const r of validRows) {
            if (r.phase && phaseRegex.test(r.phase)) {
              const depId = codeToDbId.get(r.excelCode);
              if (depId && depId !== taskId) {
                resolvedDepIds.add(depId);
              }
            }
          }
        }
      }

      for (const depTaskId of resolvedDepIds) {
        try {
          await prisma.task.update({
            where: { id: taskId },
            data: {
              dependsOn: {
                connect: { id: depTaskId },
              },
            },
          });
          importedDependencies++;
        } catch {
          // Bỏ qua nếu relation đã tồn tại
        }
      }
    }

    // Create link attachments from Attachments column
    let importedAttachments = 0;
    for (const row of validRows) {
      if (!row.attachmentUrls || row.attachmentUrls.length === 0) continue;
      const taskId = codeToDbId.get(row.excelCode);
      if (!taskId) continue;

      for (const url of row.attachmentUrls) {
        try {
          const fileName = url.split("/").pop()?.split("?")[0] || "attachment";
          await this.taskRepo.createLinkAttachment(
            taskId,
            { fileName, fileUrl: url },
            createdBy,
          );
          importedAttachments++;
        } catch {
          // Không fail import vì lỗi attachment
        }
      }
    }

    // Dispatch notifications asynchronously in background without blocking response
    if (notificationsToDispatch.length > 0) {
      setImmediate(async () => {
        for (const notif of notificationsToDispatch) {
          try {
            await notificationDispatcher.send({
              channels: [NOTIFICATION_CHANNEL.WEB],
              userId: notif.userId,
              web: {
                type: NOTIFICATION_TYPE.INFO,
                title: "Công việc mới được phân công từ Excel",
                content: `Bạn đã được phân công công việc "${notif.taskTitle}". Hạn chót: ${notif.deadline}`,
              },
            });
          } catch (err) {
            console.error("Failed to dispatch notification during import:", err);
          }
        }
      });
    }

    await createAuditLog({
      actorId: createdBy,
      action: AUDIT_ACTION.BULK_IMPORT_TASKS,
      targetType: AUDIT_TARGET_TYPE.TASK,
      targetId: resolvedGroupId,
      details: {
        importedTasks,
        importedAssignments,
        importedDependencies,
        importedAttachments,
        taskGroupId: resolvedGroupId,
        taskGroupName: resolvedGroupName,
      },
    });

    return {
      importedTasks,
      importedAssignments,
      importedDependencies,
      importedAttachments,
      skippedCodes,
      errorRows: [
        ...errorRows.map((r) => ({
          excelCode: r.excelCode,
          error: r.errors.join("; "),
        })),
        ...importErrors,
      ],
      taskGroupId: resolvedGroupId,
      taskGroupName: resolvedGroupName,
    };
  }
}

export const taskImportService = new TaskImportService();
