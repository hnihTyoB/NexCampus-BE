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
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { ACTIVITY_ACTIONS } from "../../common/constants/activity-log.constant";
import { NotificationDispatcher } from "../notifications/notification.dispatcher";
import { TaskAttachmentRepository } from "../task-attachments/task-attachment.repository";
import { TASK_PRIORITY, ASSIGNMENT_STATUS } from "../../common/constants/status.constant";

const PRIORITY_MAP: Record<string, TaskPriority> = {
  P0: TASK_PRIORITY.HIGH,
  P1: TASK_PRIORITY.MEDIUM,
  P2: TASK_PRIORITY.LOW,
};

const STATUS_MAP: Record<string, string> = {
  "To Do": ASSIGNMENT_STATUS.TODO,
  "In Progress": ASSIGNMENT_STATUS.IN_PROGRESS,
  Review: ASSIGNMENT_STATUS.REVIEW,
  Done: ASSIGNMENT_STATUS.DONE,
  Blocked: ASSIGNMENT_STATUS.BLOCKED,
};

function parseExcelDate(value: unknown): string | undefined {
  if (!value) return undefined;

  // Trường hợp 1: xlsx đã parse thành JS Date object (khi cellDates: true)
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) return value.toISOString();
    return undefined;
  }

  // Trường hợp 2: chuỗi Date của JS (ví dụ: "Wed Jul 01 2026 23:59:56 GMT+0700")
  // Hoặc ISO string: "2026-07-01T00:00:00.000Z"
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Thử parse trực tiếp (ISO hoặc locale string)
    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) return direct.toISOString();

    // Try DD/MM/YYYY
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    return undefined;
  }

  // Trường hợp 3: số serial của Excel (ví dụ: 46025 = 2026-01-01)
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

function parseListsSheet(workbook: XLSX.WorkBook): Record<string, string> {
  const sheet = workbook.Sheets["Lists"];
  if (!sheet) return {};

  const rows = XLSX.utils.sheet_to_json<{ Owners: string; Name?: string }>(
    sheet,
    { defval: null },
  );

  const mapping: Record<string, string> = {};
  for (const row of rows) {
    if (row.Owners && row.Name) {
      mapping[String(row.Owners).trim()] = String(row.Name).trim();
    }
  }
  return mapping;
}

function parseTaskSheet(
  workbook: XLSX.WorkBook,
  ownerNameMap: Record<string, string>,
): { validRows: ImportTaskRowDto[]; errorRows: { rowIndex: number; excelCode?: string; errors: string[] }[] } {
  const sheet = workbook.Sheets["Task_Phan_Cong"];
  if (!sheet) {
    throw new AppError(
      "Sheet 'Task_Phan_Cong' not found in the Excel file",
      400,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const validRows: ImportTaskRowDto[] = [];
  const errorRows: { rowIndex: number; excelCode?: string; errors: string[] }[] = [];

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
    const priority = rawPriority ? PRIORITY_MAP[rawPriority] : null;
    if (!priority) errors.push(`Priority không hợp lệ: "${rawPriority}" (cho phép: P0, P1, P2)`);

    const rawStart = row["Start"] && String(row["Start"]).trim() ? String(row["Start"]).trim() : null;
    let startDate: string | undefined;
    if (rawStart) {
      startDate = parseExcelDate(rawStart);
      if (!startDate) errors.push(`Không parse được ngày Start: "${rawStart}"`);
    }

    const rawOwner = row["Owner"] && String(row["Owner"]).trim() ? String(row["Owner"]).trim() : null;
    const ownerName = rawOwner ? (ownerNameMap[rawOwner] ?? rawOwner) : undefined;

    const rawSupport = row["Support"] && String(row["Support"]).trim() ? String(row["Support"]).trim() : null;
    const supportName = rawSupport ? (ownerNameMap[rawSupport] ?? rawSupport) : undefined;

    if (supportName && !ownerName) {
      errors.push("Không thể chỉ định Intern hỗ trợ nếu thiếu người chịu trách nhiệm chính (Owner)");
    }

    const rawStatus = row["Status"] && String(row["Status"]).trim() ? String(row["Status"]).trim() : "To Do";
    if (rawStatus && !STATUS_MAP[rawStatus]) {
      errors.push(`Trạng thái không hợp lệ: "${rawStatus}" (cho phép: To Do, In Progress, Review, Done, Blocked)`);
    }

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
      ownerName,
      supportName,
      phase: row["Giai đoạn"] ? String(row["Giai đoạn"]).trim() : undefined,
      module: row["Module"] ? String(row["Module"]).trim() : undefined,
      estDays,
      acceptanceCriteria: row["Acceptance Criteria"]
        ? String(row["Acceptance Criteria"]).trim()
        : undefined,
      taskNotes: row["Notes"] ? String(row["Notes"]).trim() : undefined,
      dependencyCodes: parseDependencies(row["Dependency"]),
      attachmentUrls: parseAttachments(row["Attachments"]),

      ...(STATUS_MAP[rawStatus] ? { _status: STATUS_MAP[rawStatus] } : {}),
    } as ImportTaskRowDto & { _status?: string });
  }

  return { validRows, errorRows };
}

export class TaskImportService {
  private readonly activityLogService = new ActivityLogService();
  private readonly attachmentRepo = new TaskAttachmentRepository();

  async preview(
    buffer: Buffer,
    taskGroupId?: string,
    taskGroupName?: string,
  ): Promise<ImportPreviewDto> {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    let resolvedGroupId: string | undefined;
    let resolvedGroupName: string | undefined;

    if (taskGroupId) {
      const tg = await prisma.taskGroup.findUnique({
        where: { id: taskGroupId },
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
      const name = (taskGroupName && taskGroupName.trim()) || "Nhóm công việc mặc định";
      const tg = await prisma.taskGroup.findUnique({
        where: { name },
      });
      resolvedGroupId = tg?.id;
      resolvedGroupName = name;
    }

    const ownerNameMap = parseListsSheet(workbook);

    const { validRows, errorRows } = parseTaskSheet(workbook, ownerNameMap);

    const uniqueOwners = [...new Set(validRows.map((r) => r.ownerName).filter((name): name is string => !!name))];

    // Batch query interns by names in uniqueOwners
    const matchingInterns = await prisma.intern.findMany({
      where: {
        fullName: { in: uniqueOwners, mode: "insensitive" },
        deletedAt: null,
      },
      select: { id: true, fullName: true },
    });

    const internByNameMap = new Map(
      matchingInterns.map((i) => [i.fullName.toLowerCase(), i]),
    );

    const internMappings = uniqueOwners.map((name) => {
      const intern = internByNameMap.get(name.toLowerCase());
      return {
        ownerName: name,
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

    let resolvedGroupId: string;
    let resolvedGroupName: string;

    if (taskGroupId) {
      const tg = await prisma.taskGroup.findUnique({
        where: { id: taskGroupId },
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
      const name = (taskGroupName && taskGroupName.trim()) || "Nhóm công việc mặc định";
      const tg = await prisma.taskGroup.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      resolvedGroupId = tg.id;
      resolvedGroupName = tg.name;
    }

    const ownerNameMap = parseListsSheet(workbook);
    const { validRows, errorRows } = parseTaskSheet(workbook, ownerNameMap);

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

    const allInterns = await prisma.intern.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, userId: true },
    });
    
    // Group interns by lowercase fullName to check for name collisions
    const internsByNameMap = new Map<string, typeof allInterns>();
    for (const intern of allInterns) {
      const key = intern.fullName.toLowerCase();
      if (!internsByNameMap.has(key)) {
        internsByNameMap.set(key, []);
      }
      internsByNameMap.get(key)!.push(intern);
    }

    let importedTasks = 0;
    let importedAssignments = 0;
    let importedDependencies = 0;
    const skippedCodes: string[] = [];
    const importErrors: { excelCode?: string; error: string }[] = [];
    const notificationsToDispatch: { userId: string; taskTitle: string; deadline: string }[] = [];

    const codeToDbId = new Map<string, string>();

    await prisma.$transaction(
      async (tx) => {
        for (const row of validRows) {
          try {
            const existingTask = await tx.task.findFirst({
              where: { taskGroupId: resolvedGroupId, code: row.excelCode },
              select: { id: true },
            });

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
                  estDays: row.estDays ?? null,
                  phase: row.phase ?? null,
                  module: row.module ?? null,
                  acceptanceCriteria: row.acceptanceCriteria ?? null,
                  taskNotes: row.taskNotes ?? null,
                  priority: row.priority,
                  taskGroupId: resolvedGroupId,
                  createdBy,
                },
                select: { id: true, title: true },
              });
              taskId = created.id;
              importedTasks++;
            }

            codeToDbId.set(row.excelCode, taskId);

            if (row.ownerName) {
              const ownerMatches = internsByNameMap.get(row.ownerName.toLowerCase()) ?? [];
              if (ownerMatches.length === 0) {
                importErrors.push({
                  excelCode: row.excelCode,
                  error: `Không tìm thấy Intern với tên "${row.ownerName}" trong hệ thống`,
                });
                continue;
              }
              if (ownerMatches.length > 1) {
                importErrors.push({
                  excelCode: row.excelCode,
                  error: `Tìm thấy nhiều Intern trùng tên "${row.ownerName}". Vui lòng giải quyết trùng lặp trước khi import.`,
                });
                continue;
              }
              const ownerIntern = ownerMatches[0];

              let supportInternId: string | null = null;
              if (row.supportName) {
                const supportMatches = internsByNameMap.get(row.supportName.toLowerCase()) ?? [];
                if (supportMatches.length === 1) {
                  supportInternId = supportMatches[0].id;
                } else if (supportMatches.length > 1) {
                  importErrors.push({
                    excelCode: row.excelCode,
                    error: `Tìm thấy nhiều Intern hỗ trợ trùng tên "${row.supportName}"`,
                  });
                } else {
                  importErrors.push({
                    excelCode: row.excelCode,
                    error: `Không tìm thấy Intern hỗ trợ với tên "${row.supportName}" trong hệ thống`,
                  });
                }
              }

              const existingAssignment = await tx.taskAssignment.findFirst({
                where: { taskId },
                select: { id: true },
              });

              const rowWithStatus = row as ImportTaskRowDto & { _status?: string };
              const mappedStatus = rowWithStatus._status;

              if (existingAssignment) {
                await tx.taskAssignment.update({
                  where: { id: existingAssignment.id },
                  data: {
                    internId: ownerIntern.id,
                    supportId: supportInternId,
                    ...(mappedStatus ? { status: mappedStatus as any } : {}),
                  },
                });
              } else {
                const defaultStatus = mappedStatus ?? ASSIGNMENT_STATUS.TODO;
                await tx.taskAssignment.create({
                  data: {
                    taskId,
                    internId: ownerIntern.id,
                    supportId: supportInternId,
                    assignedBy: createdBy,
                    status: defaultStatus as any,
                  },
                });
                importedAssignments++;

                if (defaultStatus === ASSIGNMENT_STATUS.TODO) {
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
      { timeout: 60000 }, // 60s timeout cho import lớn
    );

    // ─── BATCH RESOLVE DEPENDENCIES ───
    const allDepCodes = new Set<string>();
    for (const row of validRows) {
      row.dependencyCodes.forEach((c) => allDepCodes.add(c.trim()));
    }
    
    // Find dependency codes that are not loaded in codeToDbId
    const missingCodes = Array.from(allDepCodes).filter((c) => !codeToDbId.has(c));
    if (missingCodes.length > 0) {
      const dbDepTasks = await prisma.task.findMany({
        where: {
          taskGroupId: resolvedGroupId,
          code: { in: missingCodes },
          deletedAt: null,
        },
        select: { id: true, code: true },
      });
      for (const t of dbDepTasks) {
        if (t.code) {
          codeToDbId.set(t.code, t.id);
        }
      }
    }

    for (const row of validRows) {
      if (row.dependencyCodes.length === 0) continue;

      const taskId = codeToDbId.get(row.excelCode);
      if (!taskId) continue;

      for (const depCode of row.dependencyCodes) {
        const depTaskId = codeToDbId.get(depCode.trim());
        if (!depTaskId) {
          importErrors.push({
            excelCode: row.excelCode,
            error: `Dependency "${depCode}" không tìm thấy trong file Excel hoặc hệ thống`,
          });
          continue;
        }

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
          // Bỏ qua nếu relation đã tồn tại (duplicate connect)
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
          await this.attachmentRepo.createLink({
            taskId,
            fileName,
            fileUrl: url,
            uploadedBy: createdBy,
          });
          importedAttachments++;
        } catch {
          // Không fail import vì lỗi attachment
        }
      }
    }

    // Dispatch notifications safely outside the database transaction
    for (const notif of notificationsToDispatch) {
      try {
        await NotificationDispatcher.dispatch(notif.userId, "TASK_ASSIGNMENT", {
          taskTitle: notif.taskTitle,
          deadline: notif.deadline,
        });
      } catch (err) {
        console.error("Failed to dispatch notification during import:", err);
      }
    }

    await this.activityLogService.log(
      createdBy,
      ACTIVITY_ACTIONS.BULK_IMPORT_TASKS,
      `Import hàng loạt: ${importedTasks} task mới, ${importedAssignments} phân công, ${importedDependencies} dependency từ file Excel vào nhóm ${resolvedGroupName}`,
      undefined,
      "Task",
    );

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
