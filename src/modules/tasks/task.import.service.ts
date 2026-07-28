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

    // Nếu chuỗi là số thuần (Excel serial date bị sheet_to_json trả về dạng string),
    // parse như Excel serial date thay vì parse như date string (tránh bị hiểu nhầm là year)
    if (/^\d+$/.test(trimmed)) {
      const date = XLSX.SSF.parse_date_code(Number(trimmed));
      if (date) {
        const d = new Date(Date.UTC(date.y, date.m - 1, date.d));
        return d.toISOString();
      }
      return undefined;
    }

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

/**
 * Parse sheet "Lists": Đọc mapping Owners alias → Email (tùy chọn).
 * Cột Email có thể để trống → không phân công.
 * Format: | Owners | Email |
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

    // Owner alias → email (null = chưa phân công, undefined = alias không có trong Lists)
    const rawOwner = row["Owner"] && String(row["Owner"]).trim() ? String(row["Owner"]).trim() : null;
    let ownerEmail: string | undefined;
    if (rawOwner) {
      if (rawOwner in ownerEmailMap) {
        ownerEmail = ownerEmailMap[rawOwner] ?? undefined; // null → undefined = chưa phân công
      } else {
        // Alias không có trong Lists → coi như email trực tiếp (backward-compat)
        ownerEmail = rawOwner.includes("@") ? rawOwner.toLowerCase() : undefined;
      }
    }

    const rawSupport = row["Support"] && String(row["Support"]).trim() ? String(row["Support"]).trim() : null;
    let supportEmail: string | undefined;
    if (rawSupport) {
      if (rawSupport in ownerEmailMap) {
        supportEmail = ownerEmailMap[rawSupport] ?? undefined;
      } else {
        supportEmail = rawSupport.includes("@") ? rawSupport.toLowerCase() : undefined;
      }
    }

    if (supportEmail && !ownerEmail) {
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

    const ownerEmailMap = parseListsSheet(workbook);

    const { validRows, errorRows } = parseTaskSheet(workbook, ownerEmailMap);

    // Thu thập các email có trong file (không bị undefined)
    const uniqueEmails = [...new Set(
      validRows
        .flatMap((r) => [r.ownerEmail, r.supportEmail])
        .filter((e): e is string => !!e),
    )];

    // Batch query intern qua bảng User (email)
    const matchingInterns = await prisma.intern.findMany({
      where: {
        deletedAt: null,
        user: { email: { in: uniqueEmails, mode: "insensitive" } },
      },
      select: { id: true, fullName: true, user: { select: { email: true } } },
    });

    const internByEmailMap = new Map(
      matchingInterns.map((i) => [i.user.email.toLowerCase(), i]),
    );

    // Build internMappings: mỗi alias → email → intern
    const ownerEmailMapParsed = parseListsSheet(workbook);
    const internMappings = Object.entries(ownerEmailMapParsed)
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

    // Parse and validate before creating the task group.
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

    // Collect all emails referenced in the file
    const allEmails = [...new Set(
      validRows
        .flatMap((r) => [r.ownerEmail, r.supportEmail])
        .filter((e): e is string => !!e),
    )];

    // Lookup intern by email (qua bảng User), tránh mọi vấn đề trùng tên
    const internsByEmail = await prisma.intern.findMany({
      where: {
        deletedAt: null,
        ...(allEmails.length > 0
          ? { user: { email: { in: allEmails, mode: "insensitive" } } }
          : { id: "__none__" }), // không query nếu không có email nào
      },
      select: { id: true, fullName: true, userId: true, user: { select: { email: true } } },
    });

    // email (lower) → intern
    const internsByEmailMap = new Map(
      internsByEmail.map((i) => [i.user.email.toLowerCase(), i]),
    );

    let importedTasks = 0;
    let importedAssignments = 0;
    let importedDependencies = 0;
    const skippedCodes: string[] = [];
    const importErrors: { excelCode?: string; error: string }[] = [];
    const notificationsToDispatch: { userId: string; taskTitle: string; deadline: string }[] = [];

    let resolvedGroupId = "";
    let resolvedGroupName = "";

    const codeToDbId = new Map<string, string>();
    const titleToDbId = new Map<string, string>();

    await prisma.$transaction(
      async (tx) => {
        // Resolve/create task group INSIDE the transaction, AFTER validation passes
        if (taskGroupId) {
          const tg = await tx.taskGroup.findUnique({
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
          const tg = await tx.taskGroup.upsert({
            where: { name },
            update: {},
            create: { name },
          });
          resolvedGroupId = tg.id;
          resolvedGroupName = tg.name;
        }

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
            titleToDbId.set(row.title.toLowerCase().trim(), taskId);

            let ownerInternId: string | null = null;
            if (row.ownerEmail) {
              const ownerIntern = internsByEmailMap.get(row.ownerEmail.toLowerCase());
              if (ownerIntern) {
                ownerInternId = ownerIntern.id;
              }
              // Không có intern với email này → không phân công, không push error (email có thể sai)
            }

            let supportInternId: string | null = null;
            if (row.supportEmail) {
              const supportIntern = internsByEmailMap.get(row.supportEmail.toLowerCase());
              if (supportIntern) {
                supportInternId = supportIntern.id;
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
                  internId: ownerInternId,
                  supportId: supportInternId,
                  ...(mappedStatus ? { status: mappedStatus as any } : {}),
                },
              });
            } else {
              const defaultStatus = mappedStatus ?? ASSIGNMENT_STATUS.TODO;
              await tx.taskAssignment.create({
                data: {
                  taskId,
                  internId: ownerInternId,
                  supportId: supportInternId,
                  assignedBy: createdBy,
                  status: defaultStatus as any,
                },
              });
              importedAssignments++;

              if (ownerInternId && row.ownerEmail && defaultStatus === ASSIGNMENT_STATUS.TODO) {
                const ownerIntern = internsByEmailMap.get(row.ownerEmail.toLowerCase());
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

    // ─── BATCH RESOLVE DEPENDENCIES ───
    const allDepKeys = new Set<string>();
    for (const row of validRows) {
      row.dependencyCodes.forEach((c) => allDepKeys.add(c.trim()));
    }

    // Find dependency keys that are not loaded in codeToDbId or titleToDbId
    const missingKeys = Array.from(allDepKeys).filter(
      (k) => !codeToDbId.has(k) && !titleToDbId.has(k.toLowerCase())
    );
    if (missingKeys.length > 0) {
      const dbDepTasks = await prisma.task.findMany({
        where: {
          taskGroupId: resolvedGroupId,
          OR: [
            { code: { in: missingKeys } },
            { title: { in: missingKeys, mode: "insensitive" } }
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
        let depTaskId = codeToDbId.get(key) || titleToDbId.get(key.toLowerCase());
        
        if (depTaskId) {
          resolvedDepIds.add(depTaskId);
          continue;
        }

        const existing = await prisma.task.findFirst({
          where: {
            taskGroupId: resolvedGroupId,
            OR: [
              { code: key },
              { title: { equals: key, mode: 'insensitive' } }
            ],
            deletedAt: null
          },
          select: { id: true }
        });
        if (existing) {
          resolvedDepIds.add(existing.id);
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

          const dbPhaseTasks = await prisma.task.findMany({
            where: {
              taskGroupId: resolvedGroupId,
              phase: { contains: `Phase ${phaseNumStr}`, mode: "insensitive" },
              deletedAt: null
            },
            select: { id: true }
          });
          for (const t of dbPhaseTasks) {
            if (t.id !== taskId) {
              resolvedDepIds.add(t.id);
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
