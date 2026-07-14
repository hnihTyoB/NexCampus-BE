import { TaskPriority } from "@prisma/client";

// ─── Query / CRUD DTOs ───────────────────────────────────────────────────────

export interface TaskQueryDto {
  title?: string;
  priority?: TaskPriority;
  createdBy?: string;
  phase?: string;
  module?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  taskGroupId?: string;
  sortBy?: "createdAt" | "title" | "deadline" | "priority";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  deadline: string;
  priority?: TaskPriority;
  // Extended fields
  code?: string;
  startDate?: string;
  estDays?: number;
  phase?: string;
  module?: string;
  acceptanceCriteria?: string;
  taskNotes?: string;
  taskGroupId?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  deadline?: string;
  priority?: TaskPriority;
  // Extended fields
  code?: string | null;
  startDate?: string | null;
  estDays?: number | null;
  phase?: string | null;
  module?: string | null;
  acceptanceCriteria?: string | null;
  taskNotes?: string | null;
  taskGroupId?: string | null;
}

// ─── Bulk Import DTOs ─────────────────────────────────────────────────────────

/**
 * Một dòng đã được parse từ sheet Task_Phan_Cong, trước khi import vào DB.
 * Dùng cho cả preview và execute.
 */
export interface ImportTaskRowDto {
  excelCode: string;           // BE1-01 (dùng làm khóa dedup và resolve dependency)
  title: string;
  description: string;
  deadline: string;            // ISO date string từ Excel (cột Due)
  startDate?: string;          // ISO date string từ Excel (cột Start)
  priority: TaskPriority;      // P0→HIGH, P1→MEDIUM, P2→LOW
  ownerName?: string;          // Tên intern (Thịnh, Trà, Thanh...) từ cột Owner (optional)
  supportName?: string;        // Tên người hỗ trợ từ cột Support
  phase?: string;
  module?: string;
  estDays?: number;
  acceptanceCriteria?: string;
  taskNotes?: string;
  dependencyCodes: string[];   // ["BE1-01", "BE1-02"] từ cột Dependency
}

/**
 * Kết quả parse preview trước khi import – trả về cho UI xác nhận.
 */
export interface ImportPreviewDto {
  totalRows: number;
  validRows: ImportTaskRowDto[];
  errorRows: { rowIndex: number; excelCode?: string; errors: string[] }[];
  internMappings: { ownerName: string; internId: string | null; internFullName: string | null }[];
  taskGroupId?: string;
  taskGroupName?: string;
}

/**
 * Kết quả sau khi import thành công.
 */
export interface ImportResultDto {
  importedTasks: number;
  importedAssignments: number;
  importedDependencies: number;
  skippedCodes: string[];       // Các task đã tồn tại (theo code) → upsert bỏ qua
  errorRows: { excelCode?: string; error: string }[];
  taskGroupId?: string;
  taskGroupName?: string;
}

// ─── Analytics DTOs ───────────────────────────────────────────────────────────

export interface TaskStatusDistributionDto {
  status: string;
  count: number;
}

export interface TaskPriorityDistributionDto {
  priority: string;
  count: number;
}

export interface WorkloadByInternDto {
  internId: string;
  internFullName: string;
  totalTasks: number;
  totalEstDays: number;
  byStatus: TaskStatusDistributionDto[];
}

export interface PhaseProgressDto {
  phase: string;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;      // 0.0 – 1.0
}

export interface TaskAnalyticsDto {
  overview: {
    totalTasks: number;
    byStatus: TaskStatusDistributionDto[];
    byPriority: TaskPriorityDistributionDto[];
  };
  workloadByIntern: WorkloadByInternDto[];
  progressByPhase: PhaseProgressDto[];
}
