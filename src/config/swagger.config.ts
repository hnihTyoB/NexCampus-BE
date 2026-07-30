import { SwaggerUiOptions } from "swagger-ui-express";

export const swaggerOptions: SwaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar-wrapper .link img { display: none; }
    .swagger-ui .topbar-wrapper .link::after { content: 'NexCampus API'; color: white; font-size: 1.2rem; font-weight: bold; }
  `,
  customSiteTitle: "NexCampus API Docs",
};

export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "NexCampus API",
    version: "1.0.0",
    description:
      "Backend API cho hệ thống quản lý thực tập sinh NexCampus. Bao gồm các module: Auth, Users, Applications.",
    contact: { name: "NexCampus Team" },
  },
  servers: [{ url: "/api/v1", description: "Development server" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Nhập Access Token nhận được từ POST /auth/login",
      },
    },
    schemas: {
      // ─── Common ───────────────────────────────────────────────────────────
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          total: { type: "integer", example: 42 },
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          totalPages: { type: "integer", example: 3 },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Error message" },
          code: { type: "string", example: "NOT_FOUND" },
        },
      },
      // ─── ExportHistory ────────────────────────────────────────────────────
      ExportHistory: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          type: {
            type: "string",
            enum: ["WEEKLY_EVALUATION"],
            example: "WEEKLY_EVALUATION",
            description: "Loại báo cáo được xuất",
          },
          entityType: { type: "string", example: "WeeklyEvaluation" },
          entityId: { type: "string", format: "uuid" },
          fileName: { type: "string", example: "weekly-report-abc123-1721234567890.pdf" },
          storagePath: {
            type: "string",
            example: "reports/weekly/weekly-report-abc123-1721234567890.pdf",
          },
          fileUrl: {
            type: "string",
            format: "uri",
            example: "https://[project].supabase.co/storage/v1/object/public/report-attachments/reports/weekly/...",
            description: "URL công khai để tải báo cáo (có hiệu lực trong 30 ngày)",
          },
          createdById: { type: "string", format: "uuid" },
          expiresAt: {
            type: "string",
            format: "date-time",
            example: "2026-08-16T14:00:00.000Z",
            description: "Thời điểm file PDF hết hiệu lực trên Supabase Storage",
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      // ─── Role ─────────────────────────────────────────────────────────────
      Role: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", enum: ["ADMIN", "LEADER", "INTERN"] },
        },
      },
      // ─── User ─────────────────────────────────────────────────────────────
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          fullName: { type: "string", nullable: true },
          roleId: { type: "string", format: "uuid" },
          role: { $ref: "#/components/schemas/Role" },
          isActive: { type: "boolean" },
          avatarUrl: {
            type: "string",
            format: "uri",
            nullable: true,
            example:
              "https://[project].supabase.co/storage/v1/object/public/avatars/...",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateUserBody: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "intern@nexcampus.local",
          },
          password: {
            type: "string",
            minLength: 8,
            example: "Intern@123456",
            description: "Mật khẩu cho tài khoản. Nếu không truyền, hệ thống sẽ tự động tạo ngẫu nhiên.",
          },
          roleId: {
            type: "string",
            format: "uuid",
            example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            description: "ID của Role. Yêu cầu truyền ít nhất một trong hai: roleId hoặc roleName.",
          },
          roleName: {
            type: "string",
            enum: ["ADMIN", "LEADER", "INTERN"],
            example: "INTERN",
            description: "Tên của Role. Yêu cầu truyền ít nhất một trong hai: roleId hoặc roleName.",
          },
        },
      },
      UpdateUserBody: {
        type: "object",
        properties: {
          isActive: { type: "boolean" },
          roleId: { type: "string", format: "uuid" },
        },
      },
      // ─── Auth ─────────────────────────────────────────────────────────────
      LoginBody: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "admin@nexcampus.local",
          },
          password: { type: "string", example: "Admin@123456" },
          rememberMe: {
            type: "boolean",
            example: true,
            description: "Ghi nhớ đăng nhập (true: cookie 7 ngày, false: session cookie xóa khi đóng trình duyệt)",
          },
        },
      },
      TokenPair: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string", description: "Refresh token (Cũng được thiết lập trong HttpOnly Cookie)" },
        },
      },
      RefreshResponseData: {
        type: "object",
        properties: {
          accessToken: { type: "string", example: "eyJhbGciOi..." },
          user: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              fullName: { type: "string", nullable: true },
              role: { type: "string", example: "ADMIN" },
              avatarUrl: { type: "string", format: "uri", nullable: true },
            },
          },
        },
      },
      RefreshBody: {
        type: "object",
        properties: {
          refreshToken: { type: "string", description: "Refresh token (Có thể bỏ trống nếu sử dụng cookie)" },
        },
      },
      LogoutBody: {
        type: "object",
        properties: {
          refreshToken: { type: "string", description: "Refresh token (Có thể bỏ trống nếu sử dụng cookie)" },
        },
      },
      ForgotPasswordBody: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@nexcampus.local",
          },
        },
      },
      ResetPasswordBody: {
        type: "object",
        required: ["token", "password"],
        properties: {
          token: { type: "string", example: "39bdf11f..." },
          password: { type: "string", example: "NewPassword@123" },
        },
      },
      UpdateMeBody: {
        type: "object",
        properties: {
          fullName: { type: "string", example: "Nguyễn Văn A" },
          password: { type: "string", example: "NewPassword@123" },
          avatarUrl: { type: "string", format: "uri" },
        },
      },
      ChangePasswordBody: {
        type: "object",
        required: ["oldPassword", "newPassword", "confirmPassword"],
        properties: {
          oldPassword: { type: "string", example: "OldPassword@123" },
          newPassword: { type: "string", example: "NewPassword@123" },
          confirmPassword: { type: "string", example: "NewPassword@123" },
        },
      },
      RevokeSessionBody: {
        type: "object",
        required: ["token"],
        properties: {
          token: {
            type: "string",
            example: "eyJhbGciOi...",
            description: "Revoke JWT Token nhận được từ email cảnh báo bảo mật",
          },
        },
      },
      Me: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          fullName: { type: "string", nullable: true },
          avatarUrl: { type: "string", format: "uri", nullable: true },
          role: { type: "string", example: "INTERN" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          intern: {
            nullable: true,
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              phone: { type: "string", example: "0912345678" },
              department: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string", example: "Engineering" } } },
              position: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string", example: "Backend Intern" } } },
              startDate: { type: "string", format: "date-time" },
              duration: { type: "integer", example: 3 },
              discordUsername: { type: "string", nullable: true },
              discordRoleGranted: { type: "boolean" },
              status: { type: "string", enum: ["ACTIVE", "COMPLETED", "DROPPED"] },
            },
          },
          leader: {
            nullable: true,
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              department: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string", example: "Engineering" },
                },
              },
              position: { type: "string", nullable: true, example: "Engineering Manager" },
              phone: { type: "string", nullable: true, example: "0912345678" },
            },
          },
          notificationSetting: {
            nullable: true,
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              webEnabled: { type: "boolean" },
              emailEnabled: { type: "boolean" },
              discordEnabled: { type: "boolean" },
            },
          },
        },
      },
      // ─── Application ──────────────────────────────────────────────────────
      Application: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string", example: "Nguyễn Văn A" },
          email: { type: "string", format: "email" },
          phone: { type: "string", example: "0912345678" },
          departmentId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
          positionId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440001" },
          startDate: { type: "string", format: "date-time" },
          duration: {
            type: "integer",
            example: 3,
            description: "Số tháng thực tập",
          },
          status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
          approvedBy: { type: "string", format: "uuid", nullable: true },
          approvedAt: { type: "string", format: "date-time", nullable: true },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          approver: {
            nullable: true,
            allOf: [
              {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  email: { type: "string", format: "email" },
                  fullName: { type: "string", nullable: true },
                },
              },
            ],
          },
          attachments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                fileName: { type: "string" },
                fileUrl: { type: "string", format: "uri" },
                fileSize: { type: "integer" },
                mimeType: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      CreateApplicationBody: {
        type: "object",
        required: [
          "fullName",
          "email",
          "phone",
          "departmentId",
          "positionId",
          "startDate",
          "duration",
          "token",
          "regulationId",
          "acceptedRegulations",
        ],
        properties: {
          fullName: { type: "string", example: "Nguyễn Văn A" },
          email: { type: "string", format: "email", example: "vana@gmail.com" },
          phone: { type: "string", example: "0912345678" },
          departmentId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
          positionId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440001" },
          startDate: { type: "string", format: "date", example: "2025-08-01" },
          duration: {
            type: "integer",
            example: 3,
            description: "Số tháng thực tập",
          },
          token: { type: "string", example: "39bdf11f..." },
          regulationId: {
            type: "string",
            format: "uuid",
            example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          },
          acceptedRegulations: { type: "boolean", example: true },
        },
      },
      ReviewApplicationBody: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["APPROVED", "REJECTED"] },
        },
      },
      CreateInviteBody: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", example: "candidate@gmail.com" },
        },
      },
      ApplicationInvite: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          token: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "USED", "EXPIRED", "REVOKED"] },
          expiresAt: { type: "string", format: "date-time" },
          usedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      // ─── Regulation ────────────────────────────────────────────────────────
      Regulation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string", example: "Quy định thực tập tại NexCampus" },
          content: { type: "string", example: "<h3>QUY ĐỊNH CHUNG</h3>..." },
          version: { type: "integer", example: 1 },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateRegulationBody: {
        type: "object",
        required: ["title", "content"],
        properties: {
          title: { type: "string", example: "Quy định thực tập tại NexCampus" },
          content: { type: "string", example: "<h3>QUY ĐỊNH CHUNG</h3>..." },
          isActive: { type: "boolean", example: false },
        },
      },
      UpdateRegulationBody: {
        type: "object",
        properties: {
          title: { type: "string", example: "Quy định thực tập tại NexCampus" },
          content: { type: "string", example: "<h3>QUY ĐỊNH CHUNG</h3>..." },
          isActive: { type: "boolean", example: false },
        },
      },
      // ─── Intern ────────────────────────────────────────────────────
      Intern: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          leaderId: { type: "string", format: "uuid", nullable: true },
          fullName: { type: "string", example: "Nguyễn Chí Thịnh" },
          phone: { type: "string", example: "0912345678" },
          departmentId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
          positionId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440001" },
          startDate: { type: "string", format: "date-time" },
          duration: {
            type: "integer",
            example: 3,
            description: "Số tháng thực tập",
          },
          discordUsername: { type: "string", nullable: true },
          discordRoleGranted: { type: "boolean", example: false },
          status: { type: "string", enum: ["ACTIVE", "COMPLETED", "DROPPED"] },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              fullName: { type: "string", nullable: true },
              isActive: { type: "boolean" },
            },
          },
          leader: {
            nullable: true,
            allOf: [
              {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  email: { type: "string", format: "email" },
                  fullName: { type: "string", nullable: true },
                  isActive: { type: "boolean" },
                },
              },
            ],
          },
        },
      },
      CreateInternBody: {
        type: "object",
        required: [
          "userId",
          "fullName",
          "phone",
          "departmentId",
          "positionId",
          "startDate",
          "duration",
        ],
        properties: {
          userId: { type: "string", format: "uuid" },
          leaderId: { type: "string", format: "uuid" },
          fullName: { type: "string", example: "Nguyễn Chí Thịnh" },
          phone: { type: "string", example: "0912345678" },
          departmentId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
          positionId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440001" },
          startDate: { type: "string", format: "date", example: "2025-08-01" },
          duration: { type: "integer", example: 3 },
          discordUsername: { type: "string", example: "chithinhdev" },
        },
      },
      DirectCreateInternBody: {
        type: "object",
        required: [
          "email",
          "fullName",
          "phone",
          "departmentId",
          "positionId",
          "startDate",
          "duration",
        ],
        properties: {
          email: { type: "string", format: "email" },
          leaderId: { type: "string", format: "uuid" },
          fullName: { type: "string", maxLength: 100 },
          phone: { type: "string", example: "0912345678" },
          departmentId: { type: "string", format: "uuid" },
          positionId: { type: "string", format: "uuid" },
          startDate: { type: "string", format: "date" },
          duration: { type: "integer", minimum: 1 },
          discordUsername: { type: "string" },
        },
      },
      UpdateInternBody: {
        type: "object",
        properties: {
          fullName: { type: "string" },
          phone: { type: "string" },
          department: { type: "string" },
          position: { type: "string" },
          startDate: { type: "string", format: "date" },
          duration: { type: "integer" },
          discordUsername: { type: "string", nullable: true },
          discordRoleGranted: { type: "boolean" },
          status: { type: "string", enum: ["ACTIVE", "COMPLETED", "DROPPED"] },
        },
      },
      // ─── Leader ──────────────────────────────────────────────────
      Leader: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          departmentId: { type: "string", format: "uuid", nullable: true },
          position: { type: "string", nullable: true, example: "Engineering Manager" },
          phone: { type: "string", nullable: true, example: "0912345678" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              fullName: { type: "string", nullable: true },
              isActive: { type: "boolean" },
              avatarUrl: { type: "string", nullable: true },
            },
          },
          department: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string", example: "Engineering" },
            },
          },
        },
      },
      CreateLeaderBody: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: { type: "string", format: "uuid" },
          departmentId: { type: "string", format: "uuid" },
          position: { type: "string", example: "Engineering Manager" },
          phone: { type: "string", example: "0912345678" },
        },
      },
      UpdateLeaderBody: {
        type: "object",
        properties: {
          departmentId: { type: "string", format: "uuid", nullable: true },
          position: { type: "string", nullable: true },
          phone: { type: "string" },
        },
      },
      TaskGroup: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Backend Crawl Project" },
          description: { type: "string", nullable: true, example: "Dự án cào dữ liệu Backend" },
          departmentId: { type: "string", format: "uuid", nullable: true },
          department: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string", example: "Backend Development" },
            },
          },
          _count: {
            type: "object",
            properties: {
              tasks: { type: "integer", example: 5 },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          taskGroupId: { type: "string", format: "uuid", nullable: true },
          code: { type: "string", nullable: true, example: "BE1-01" },
          title: { type: "string", example: "Lập trình tính năng đăng nhập" },
          description: {
            type: "string",
            nullable: true,
            example: "Sử dụng JWT và bcrypt để bảo mật mật khẩu",
          },
          deadline: { type: "string", format: "date-time" },
          startDate: { type: "string", format: "date-time", nullable: true, example: "2025-08-01T08:00:00.000Z" },
          estDays: { type: "number", format: "float", nullable: true, example: 2.5 },
          phase: { type: "string", nullable: true, example: "Phase 1 - Foundation" },
          module: { type: "string", nullable: true, example: "Auth" },
          acceptanceCriteria: { type: "string", nullable: true, example: "Source chạy được pnpm dev/build" },
          taskNotes: { type: "string", nullable: true, example: "Ghi chú thêm" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          createdBy: { type: "string", format: "uuid" },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          taskGroup: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string", example: "Backend Crawl Project" },
            },
          },
          creator: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              fullName: { type: "string", nullable: true },
            },
          },
          attachments: {
            type: "array",
            description: "Danh sách file đính kèm của task",
            items: { $ref: "#/components/schemas/TaskAttachment" },
          },
          dependsOn: {
            type: "array",
            description: "Các task mà task này phụ thuộc vào",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                code: { type: "string", example: "BE1-01" },
                title: { type: "string" },
              },
            },
          },
          dependencies: {
            type: "array",
            description: "Các task phụ thuộc vào task này",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                code: { type: "string", example: "BE1-02" },
                title: { type: "string" },
              },
            },
          },
        },
      },
      CreateTaskBody: {
        type: "object",
        required: ["title", "deadline"],
        properties: {
          title: { type: "string", example: "Lập trình tính năng đăng nhập" },
          description: { type: "string", example: "Sử dụng JWT và bcrypt" },
          deadline: {
            type: "string",
            format: "date-time",
            example: "2025-08-10T17:00:00.000Z",
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
            default: "MEDIUM",
          },
          code: { type: "string", example: "BE1-01" },
          startDate: { type: "string", format: "date-time", example: "2025-08-01T08:00:00.000Z" },
          estDays: { type: "number", format: "float", example: 2.5 },
          phase: { type: "string", example: "Phase 1 - Foundation" },
          module: { type: "string", example: "Auth" },
          acceptanceCriteria: { type: "string", example: "Source chạy được pnpm dev/build" },
          taskNotes: { type: "string", example: "Ghi chú thêm" },
          taskGroupId: { type: "string", format: "uuid" },
        },
      },
      UpdateTaskBody: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string", nullable: true },
          deadline: { type: "string", format: "date-time" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          code: { type: "string", nullable: true },
          startDate: { type: "string", format: "date-time", nullable: true },
          estDays: { type: "number", format: "float", nullable: true },
          phase: { type: "string", nullable: true },
          module: { type: "string", nullable: true },
          acceptanceCriteria: { type: "string", nullable: true },
          taskNotes: { type: "string", nullable: true },
          taskGroupId: { type: "string", format: "uuid", nullable: true },
        },
      },
      TaskAiRecommendationCandidate: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", example: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
          name: { type: "string", example: "Nguyễn Văn A" },
          position: { type: "string", nullable: true, example: "Backend Developer" },
          compatibilityScore: { type: "number", example: 92 },
          workloadScore: { type: "number", example: 80 },
          performanceScore: { type: "number", example: 85 },
          skillScore: { type: "number", example: 100 },
          learningScore: { type: "number", example: 80 },
          activeTaskDays: { type: "number", example: 2 },
          codingScore: { type: "number", nullable: true, example: 8.5 },
        },
      },
      TaskAiRecommendationResponse: {
        type: "object",
        properties: {
          owner: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid", example: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
              name: { type: "string", example: "Nguyễn Văn A" },
              position: { type: "string", nullable: true, example: "Backend Developer" },
              compatibilityScore: { type: "number", example: 92 },
              workloadDays: { type: "number", example: 2 },
              codingScore: { type: "number", nullable: true, example: 8.5 },
            },
          },
          support: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", format: "uuid", example: "4gb96f75-6828-5673-c4gd-3d074g77bgb7" },
              name: { type: "string", example: "Trần Văn B" },
              position: { type: "string", nullable: true, example: "Backend Developer" },
              compatibilityScore: { type: "number", example: 78 },
              workloadDays: { type: "number", example: 6 },
              codingScore: { type: "number", nullable: true, example: 9.0 },
            },
          },
          reasons: {
            type: "array",
            items: { type: "string" },
            example: [
              "Workload thấp - đang gánh 2 ngày công",
              "Position phù hợp với yêu cầu của task",
              "Điểm Coding gần nhất: 8.5/10",
            ],
          },
          riskLevel: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
            example: "LOW",
          },
          workloadAnalysis: {
            type: "string",
            example: "Nguyễn Văn A hiện đang gánh 2 ngày công (capacity 10 ngày).",
          },
          learningOpportunity: {
            type: "string",
            example: "Đây là cơ hội tốt để Nguyễn Văn A mở rộng kinh nghiệm với task này.",
          },
          allCandidates: {
            type: "array",
            items: { $ref: "#/components/schemas/TaskAiRecommendationCandidate" },
          },
          meta: {
            type: "object",
            properties: {
              totalEvaluated: { type: "integer", example: 3 },
              aiFailed: { type: "boolean", example: false },
              generatedAt: { type: "string", format: "date-time", example: "2026-07-21T12:00:00.000Z" },
            },
          },
        },
      },
      // ─── TaskAttachment ───────────────────────────────────────────────────────
      TaskAttachment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          taskId: { type: "string", format: "uuid" },
          fileName: { type: "string", example: "design-mockup.zip" },
          fileUrl: {
            type: "string",
            format: "uri",
            example:
              "https://[project].supabase.co/storage/v1/object/public/task-attachments/...",
          },
          filePath: {
            type: "string",
            example: "uuid-task-id/uuid_design-mockup.zip",
          },
          mimeType: { type: "string", example: "application/zip" },
          fileSize: {
            type: "integer",
            description: "Kích thước file tính bằng bytes",
            example: 204800,
          },
          uploadedBy: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      TaskAssignment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          taskId: { type: "string", format: "uuid" },
          internId: { type: "string", format: "uuid" },
          assignedBy: { type: "string", format: "uuid" },
          status: {
            type: "string",
            enum: ["PENDING_APPROVAL", "TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"],
          },
          assignedAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateTaskAssignmentBody: {
        type: "object",
        required: ["taskId", "internId"],
        properties: {
          taskId: { type: "string", format: "uuid" },
          internId: { type: "string", format: "uuid" },
        },
      },
      UpdateTaskAssignmentBody: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"],
          },
          internId: { type: "string", format: "uuid" },
        },
      },
      TaskSubmission: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          assignmentId: { type: "string", format: "uuid" },
          attempt: { type: "integer" },
          prLink: { type: "string", format: "uri", nullable: true },
          videoDemo: { type: "string", format: "uri", nullable: true },
          note: { type: "string", nullable: true },
          reviewStatus: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED"],
          },
          reviewComment: { type: "string", nullable: true },
          reviewedBy: { type: "string", format: "uuid", nullable: true },
          reviewedAt: { type: "string", format: "date-time", nullable: true },
          submittedAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          attachments: {
            type: "array",
            description: "Danh sách file đính kèm của bài nộp",
            items: { $ref: "#/components/schemas/SubmissionAttachment" },
          },
        },
      },
      CreateTaskSubmissionBody: {
        type: "object",
        required: ["assignmentId"],
        properties: {
          assignmentId: { type: "string", format: "uuid" },
          prLink: { type: "string", format: "uri" },
          videoDemo: { type: "string", format: "uri" },
          note: { type: "string" },
        },
      },
      UpdateTaskSubmissionBody: {
        type: "object",
        properties: {
          prLink: { type: "string", format: "uri", nullable: true },
          videoDemo: { type: "string", format: "uri", nullable: true },
          note: { type: "string", nullable: true },
          reviewStatus: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED"],
          },
          reviewComment: { type: "string", nullable: true },
        },
      },
      // ─── SubmissionAttachment ──────────────────────────────────────────────────
      SubmissionAttachment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          submissionId: { type: "string", format: "uuid" },
          fileName: { type: "string", example: "test-report.pdf" },
          fileUrl: {
            type: "string",
            format: "uri",
            example:
              "https://[project].supabase.co/storage/v1/object/public/submission-attachments/...",
          },
          filePath: {
            type: "string",
            example: "uuid-submission-id/uuid_test-report.pdf",
          },
          mimeType: { type: "string", example: "application/pdf" },
          fileSize: {
            type: "integer",
            description: "Kích thước file tính bằng bytes",
            example: 1048576,
          },
          uploadedBy: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      DailyReport: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          internId: { type: "string", format: "uuid" },
          content: { type: "string" },
          prLink: { type: "string", format: "uri", nullable: true },
          videoDemo: { type: "string", format: "uri", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          attachments: {
            type: "array",
            description: "Danh sách file đính kèm của báo cáo",
            items: { $ref: "#/components/schemas/ReportAttachment" },
          },
        },
      },
      CreateDailyReportBody: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string" },
          prLink: { type: "string", format: "uri" },
          videoDemo: { type: "string", format: "uri" },
        },
      },
      UpdateDailyReportBody: {
        type: "object",
        properties: {
          content: { type: "string" },
          prLink: { type: "string", format: "uri", nullable: true },
          videoDemo: { type: "string", format: "uri", nullable: true },
        },
      },
      // ─── ReportAttachment ──────────────────────────────────────────────────────
      ReportAttachment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          reportId: { type: "string", format: "uuid" },
          fileName: { type: "string", example: "screenshot.png" },
          fileUrl: {
            type: "string",
            format: "uri",
            example:
              "https://[project].supabase.co/storage/v1/object/public/report-attachments/...",
          },
          filePath: {
            type: "string",
            example: "uuid-report-id/uuid_screenshot.png",
          },
          mimeType: { type: "string", example: "image/png" },
          fileSize: {
            type: "integer",
            description: "Kích thước file tính bằng bytes",
            example: 51200,
          },
          uploadedBy: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      WeeklyEvaluation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          internId: { type: "string", format: "uuid" },
          leaderId: { type: "string", format: "uuid" },
          week: { type: "integer" },
          communication: { type: "number" },
          attitude: { type: "number" },
          learning: { type: "number" },
          coding: { type: "number" },
          totalScore: { type: "number" },
          comment: { type: "string", nullable: true },
          ratings: {
            type: "object",
            nullable: true,
            description: "Bảng xếp loại 12 tiêu chí (mẫu mới). Null nếu dùng mẫu cũ.",
          },
          aiRatings: {
            type: "object",
            nullable: true,
            description: "Bảng xếp loại 12 tiêu chí do AI gợi ý. Null nếu không dùng AI.",
          },
          aiCommunication: {
            type: "number",
            nullable: true,
            description: "Điểm giao tiếp gốc của AI",
          },
          aiAttitude: {
            type: "number",
            nullable: true,
            description: "Điểm thái độ gốc của AI",
          },
          aiLearning: {
            type: "number",
            nullable: true,
            description: "Điểm tự học gốc của AI",
          },
          aiCoding: {
            type: "number",
            nullable: true,
            description: "Điểm viết code gốc của AI",
          },
          aiComment: {
            type: "string",
            nullable: true,
            description: "Nhận xét gốc của AI",
          },
          aiGeneratedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "Thời điểm AI sinh gợi ý",
          },
          leaderEdited: {
            type: "boolean",
            description:
              "Đánh dấu Leader có chỉnh sửa điểm so với AI hay không",
          },
          reviewedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "Thời điểm Intern xác nhận đã xem đánh giá. Null = chưa xem.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateWeeklyEvaluationBody: {
        type: "object",
        required: [
          "internId",
          "week",
          "communication",
          "attitude",
          "learning",
          "coding",
        ],
        properties: {
          internId: { type: "string", format: "uuid" },
          week: { type: "integer" },
          communication: { type: "number", minimum: 0, maximum: 10 },
          attitude: { type: "number", minimum: 0, maximum: 10 },
          learning: { type: "number", minimum: 0, maximum: 10 },
          coding: { type: "number", minimum: 0, maximum: 10 },
          comment: { type: "string" },
          aiCommunication: { type: "number", minimum: 0, maximum: 10 },
          aiAttitude: { type: "number", minimum: 0, maximum: 10 },
          aiLearning: { type: "number", minimum: 0, maximum: 10 },
          aiCoding: { type: "number", minimum: 0, maximum: 10 },
          aiComment: { type: "string" },
        },
      },
      UpdateWeeklyEvaluationBody: {
        type: "object",
        properties: {
          communication: { type: "number", minimum: 0, maximum: 10 },
          attitude: { type: "number", minimum: 0, maximum: 10 },
          learning: { type: "number", minimum: 0, maximum: 10 },
          coding: { type: "number", minimum: 0, maximum: 10 },
          comment: { type: "string", nullable: true },
        },
      },
      AiSuggestionRequestBody: {
        type: "object",
        required: ["internId", "week"],
        properties: {
          internId: {
            type: "string",
            format: "uuid",
            example: "d82c2533-7004-4835-a379-5f4a534a1994",
          },
          week: { type: "integer", minimum: 1, example: 1 },
        },
      },
      AiSuggestionResponse: {
        type: "object",
        properties: {
          communication: { type: "number", example: 8.5 },
          attitude: { type: "number", example: 9.0 },
          learning: { type: "number", example: 8.0 },
          coding: { type: "number", example: 7.5 },
          comment: {
            type: "string",
            example: "Thực tập sinh thể hiện tinh thần tốt...",
          },
          strengths: {
            type: "array",
            items: { type: "string" },
            example: ["Báo cáo daily đầy đủ", "Nhanh tiếp thu"],
          },
          weaknesses: {
            type: "array",
            items: { type: "string" },
            example: ["Lần submit đầu thiếu test case expired"],
          },
          suggestions: {
            type: "array",
            items: { type: "string" },
            example: ["Nên test kỹ hơn", "Phát huy tinh thần tự học"],
          },
          dataUsed: {
            type: "object",
            properties: {
              dailyReportsCount: { type: "integer", example: 5 },
              taskSubmissionsCount: { type: "integer", example: 3 },
              weekRange: {
                type: "object",
                properties: {
                  from: { type: "string", format: "date-time" },
                  to: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
      NotificationLog: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          notificationId: { type: "string", format: "uuid" },
          channel: { type: "string", enum: ["WEB", "EMAIL", "DISCORD"] },
          status: { type: "string", enum: ["SUCCESS", "FAILED"] },
          sentAt: { type: "string", format: "date-time" },
        },
      },
      CreateNotificationLogBody: {
        type: "object",
        required: ["notificationId", "channel", "status"],
        properties: {
          notificationId: { type: "string", format: "uuid" },
          channel: { type: "string", enum: ["WEB", "EMAIL", "DISCORD"] },
          status: { type: "string", enum: ["SUCCESS", "FAILED"] },
        },
      },
      UpdateNotificationLogBody: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["WEB", "EMAIL", "DISCORD"] },
          status: { type: "string", enum: ["SUCCESS", "FAILED"] },
        },
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          title: { type: "string" },
          content: { type: "string" },
          type: { type: "string" },
          isRead: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateNotificationBody: {
        type: "object",
        required: ["userId", "title", "content", "type"],
        properties: {
          userId: { type: "string", format: "uuid" },
          title: { type: "string" },
          content: { type: "string" },
          type: { type: "string" },
        },
      },
      NotificationSetting: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          webEnabled: { type: "boolean" },
          emailEnabled: { type: "boolean" },
          discordEnabled: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateNotificationSettingBody: {
        type: "object",
        properties: {
          webEnabled: { type: "boolean" },
          emailEnabled: { type: "boolean" },
          discordEnabled: { type: "boolean" },
        },
      },
      NotificationTemplate: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          type: { type: "string" },
          titleTemplate: { type: "string" },
          contentTemplate: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UpdateNotificationTemplateBody: {
        type: "object",
        properties: {
          titleTemplate: { type: "string" },
          contentTemplate: { type: "string" },
        },
      },
      ActivityLog: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          action: { type: "string" },
          targetId: { type: "string", format: "uuid", nullable: true },
          targetType: { type: "string", nullable: true },
          description: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              fullName: { type: "string", nullable: true },
              role: {
                type: "object",
                properties: {
                  name: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    parameters: {
      PageParam: {
        in: "query",
        name: "page",
        schema: { type: "integer", default: 1 },
      },
      LimitParam: {
        in: "query",
        name: "limit",
        schema: { type: "integer", default: 20, maximum: 100 },
      },
      OrderParam: {
        in: "query",
        name: "order",
        schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
      },
    },
    // ─── Reusable responses ───────────────────────────────────────────────────
    responses: {
      Unauthorized: {
        description: "Chưa đăng nhập",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      Forbidden: {
        description: "Không có quyền",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      NotFound: {
        description: "Không tìm thấy",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      Validation: {
        description: "Dữ liệu không hợp lệ",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      BadRequest: {
        description: "Yêu cầu không hợp lệ",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
    },
  },
  tags: [
    { name: "Auth", description: "Đăng nhập, làm mới token, đăng xuất" },
    { name: "Users", description: "Quản lý tài khoản người dùng (Admin only)" },
    { name: "Applications", description: "Đơn xin thực tập (Onboarding)" },
    { name: "Departments", description: "Phòng ban và vị trí thực tập" },
    { name: "Interns", description: "Hồ sơ thực tập sinh (Interns)" },
    { name: "Leaders", description: "Hồ sơ leader (Leaders)" },
    { name: "Tasks", description: "Quản lý công việc (Tasks)" },
    {
      name: "TaskGroups",
      description: "Nhóm công việc (Task Groups) — CRUD quản lý nhóm task",
    },
    {
      name: "TaskAttachments",
      description:
        "File đính kèm của Task — tài liệu hướng dẫn, thiết kế, zip mã nguồn",
    },
    {
      name: "TaskAssignments",
      description: "Giao việc cho thực tập sinh (Assignments)",
    },
    {
      name: "TaskSubmissions",
      description: "Nộp bài và duyệt bài của thực tập sinh (Submissions)",
    },
    {
      name: "SubmissionAttachments",
      description: "File đính kèm của bài nộp thực tập sinh (Submissions)",
    },
    {
      name: "DailyReports",
      description: "Báo cáo hàng ngày của thực tập sinh (Daily Reports)",
    },
    {
      name: "ReportAttachments",
      description: "File đính kèm của báo cáo hàng ngày (Daily Reports)",
    },
    {
      name: "WeeklyEvaluations",
      description: "Đánh giá hàng tuần của Leader (Weekly Evaluations)",
    },
    {
      name: "NotificationLogs",
      description: "Nhật ký gửi thông báo (Notification Logs)",
    },
    {
      name: "Notifications",
      description: "Thông báo của người dùng (Notifications)",
    },
    {
      name: "NotificationSettings",
      description: "Cấu hình nhận thông báo (Notification Settings)",
    },
    {
      name: "NotificationTemplates",
      description: "Quản lý mẫu thông báo (Notification Templates)",
    },
    { name: "Stats", description: "Thống kê dashboard (Dashboard Statistics)" },
    { name: "System", description: "Health check" },
  ],
  paths: {
    // ─── System ─────────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: {
            description: "Server đang chạy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── Auth ────────────────────────────────────────────────────────────────
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Đăng nhập",
        description: "Đăng nhập vào hệ thống. API trả về accessToken và thông tin user ở response body, đồng thời tự động thiết lập Cookie `refreshToken` (HttpOnly, Secure, SameSite). Nếu `rememberMe=true`, cookie có thời hạn 7 ngày; nếu `false`, cookie là session cookie bị xóa khi đóng trình duyệt.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Đăng nhập thành công (Đồng thời tự động trả về cookie 'refreshToken' HttpOnly)",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TokenPair" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: {
            description: "Sai thông tin đăng nhập",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Lấy thông tin người dùng hiện tại",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Thông tin tài khoản đang đăng nhập",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Me" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Auth"],
        summary: "Cập nhật thông tin cá nhân",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateMeBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Me" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Làm mới Access Token & khôi phục thông tin User",
        description: "Làm mới cặp token và trả về thông tin User. API lấy `refreshToken` tự động từ HttpOnly Cookie. Sau khi thành công sẽ thiết lập lại Cookie `refreshToken` mới và trả về `accessToken` + `user`.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Access token mới và thông tin người dùng",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/RefreshResponseData" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Đăng xuất (thu hồi Refresh Token)",
        description: "Đăng xuất tài khoản. API hỗ trợ lấy `refreshToken` tự động từ HttpOnly Cookie hoặc từ request body (fallback). Sau khi thành công sẽ xóa token khỏi database và xóa Cookie `refreshToken` ở trình duyệt.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LogoutBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Đăng xuất thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Token không tồn tại",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Yêu cầu khôi phục mật khẩu",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ForgotPasswordBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Yêu cầu khôi phục mật khẩu đã được tiếp nhận",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Đặt lại mật khẩu mới",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResetPasswordBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Đặt lại mật khẩu thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Token không hợp lệ hoặc đã hết hạn",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Đổi mật khẩu cho người dùng đã đăng nhập",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChangePasswordBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Thay đổi mật khẩu thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: { type: "string", example: "Thay đổi mật khẩu thành công." },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Mật khẩu cũ không đúng hoặc mật khẩu mới trùng mật khẩu cũ",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/auth/revoke-session": {
      post: {
        tags: ["Auth"],
        summary: "Vô hiệu hóa & thu hồi tất cả phiên đăng nhập (Đây không phải tôi)",
        description: "API nhận JWT Revoke Token từ email cảnh báo bảo mật, tiến hành xóa toàn bộ Refresh Token của tài khoản và ghi nhận nhật ký hệ thống.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RevokeSessionBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Thu hồi tất cả phiên đăng nhập thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: {
                          type: "string",
                          example: "Đã vô hiệu hóa tất cả các phiên đăng nhập thành công. Tài khoản của bạn hiện đã được bảo mật.",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Mã xác thực không hợp lệ hoặc đã hết hạn",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    // ─── Users ───────────────────────────────────────────────────────────────
    "/users": {
      get: {
        tags: ["Users"],
        summary: "Danh sách tài khoản (có filter, sort, phân trang)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "email",
            schema: { type: "string" },
            description: "Tìm theo email (contains)",
          },
          {
            in: "query",
            name: "fullName",
            schema: { type: "string" },
            description: "Tìm theo tên (contains)",
          },
          {
            in: "query",
            name: "roleName",
            schema: { type: "string", enum: ["ADMIN", "LEADER", "INTERN"] },
            description: "Lọc theo role",
          },
          {
            in: "query",
            name: "isActive",
            schema: { type: "string", enum: ["true", "false"] },
            description: "Lọc theo trạng thái",
          },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["createdAt", "email", "fullName"],
              default: "createdAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
        ],
        responses: {
          200: {
            description: "Danh sách user có phân trang",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/User" },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Tạo tài khoản mới (Admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateUserBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Tài khoản đã tạo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/User" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          409: {
            description: "Email đã tồn tại",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Chi tiết tài khoản theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin user",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/User" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Cập nhật tài khoản (kích hoạt/đổi role)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateUserBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/User" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Xóa tài khoản người dùng (Admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Xóa tài khoản thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/users/avatar": {
      post: {
        tags: ["Users"],
        summary: "Tải lên hoặc cập nhật ảnh đại diện (Avatar) của chính mình",
        description:
          "Tải lên ảnh đại diện của tài khoản đang đăng nhập. Hỗ trợ các định dạng hình ảnh (JPEG, PNG, WEBP, GIF). Dung lượng tối đa cấu hình qua `SUPABASE_STORAGE_MAX_FILE_SIZE_MB`. Sau khi tải lên thành công, hệ thống tự động xóa ảnh đại diện cũ trên Storage (nếu có) và cập nhật trường `avatarUrl` của User.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["avatar"],
                properties: {
                  avatar: {
                    type: "string",
                    format: "binary",
                    description: "File hình ảnh làm ảnh đại diện",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Đã tải lên ảnh đại diện thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/User" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description:
              "File không hợp lệ (không phải ảnh hoặc quá dung lượng)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/applications/invites": {
      post: {
        tags: ["Applications"],
        summary: "Tạo liên kết mời nộp đơn (Admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateInviteBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Đã tạo lời mời thành công và gửi email",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            invite: { $ref: "#/components/schemas/ApplicationInvite" },
                            link: { type: "string" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
      get: {
        tags: ["Applications"],
        summary: "Danh sách lời mời nộp đơn (Admin, Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: "query", name: "email", schema: { type: "string" }, description: "Tìm kiếm theo email" },
          { in: "query", name: "inviteStatus", schema: { type: "string", enum: ["ACTIVE", "USED", "EXPIRED", "REVOKED"] }, description: "Lọc trạng thái invite" },
          { in: "query", name: "applicationStatus", schema: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] }, description: "Lọc trạng thái application" },
          { in: "query", name: "department", schema: { type: "string" }, description: "Tìm kiếm phòng ban" },
          { in: "query", name: "position", schema: { type: "string" }, description: "Tìm kiếm vị trí" },
          { in: "query", name: "createdFrom", schema: { type: "string", format: "date-time" }, description: "Lọc từ ngày tạo" },
          { in: "query", name: "createdTo", schema: { type: "string", format: "date-time" }, description: "Lọc đến ngày tạo" },
          { in: "query", name: "sortBy", schema: { type: "string", enum: ["createdAt", "expiresAt", "email"] }, description: "Sắp xếp theo" },
          { in: "query", name: "order", schema: { type: "string", enum: ["asc", "desc"] }, description: "Thứ tự" },
          { in: "query", name: "page", schema: { type: "integer", default: 1 }, description: "Trang" },
          { in: "query", name: "limit", schema: { type: "integer", default: 20 }, description: "Số lượng/trang" },
        ],
        responses: {
          200: {
            description: "Danh sách lời mời",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string", format: "uuid" },
                              email: { type: "string", format: "email" },
                              status: { type: "string", enum: ["ACTIVE", "USED", "EXPIRED", "REVOKED"] },
                              expiresAt: { type: "string", format: "date-time" },
                              usedAt: { type: "string", format: "date-time", nullable: true },
                              createdAt: { type: "string", format: "date-time" },
                              application: {
                                type: "object", nullable: true,
                                properties: {
                                  id: { type: "string", format: "uuid" },
                                  fullName: { type: "string" },
                                  department: { type: "string" },
                                  position: { type: "string" },
                                  status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
                                  startDate: { type: "string", format: "date-time" },
                                  duration: { type: "integer" },
                                },
                              },
                              creator: {
                                type: "object", nullable: true,
                                properties: {
                                  id: { type: "string", format: "uuid" },
                                  fullName: { type: "string" },
                                },
                              },
                            },
                          },
                        },
                        meta: {
                          type: "object",
                          properties: {
                            total: { type: "integer" },
                            page: { type: "integer" },
                            limit: { type: "integer" },
                            totalPages: { type: "integer" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/applications/invites/verify": {
      get: {
        tags: ["Applications"],
        summary: "Xác thực link mời nộp đơn",
        parameters: [
          {
            in: "query",
            name: "token",
            required: true,
            schema: { type: "string" },
            description: "Mã token của lời mời",
          },
        ],
        responses: {
          200: {
            description: "Token hợp lệ",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            valid: { type: "boolean", example: true },
                            email: { type: "string", format: "email" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Token không hợp lệ hoặc đã hết hạn",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/applications": {
      post: {
        tags: ["Applications"],
        summary: "Nộp đơn xin thực tập (Public — không cần đăng nhập)",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: [
                  "fullName",
                  "email",
                  "phone",
                  "departmentId",
                  "positionId",
                  "startDate",
                  "duration",
                  "token",
                  "regulationId",
                  "acceptedRegulations",
                ],
                properties: {
                  fullName: { type: "string", example: "Nguyễn Văn A" },
                  email: { type: "string", format: "email", example: "vana@gmail.com" },
                  phone: { type: "string", example: "0912345678" },
                  departmentId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
                  positionId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440001" },
                  startDate: { type: "string", format: "date", example: "2025-08-01" },
                  duration: { type: "integer", example: 3 },
                  token: { type: "string", example: "39bdf11f..." },
                  regulationId: { type: "string", format: "uuid" },
                  acceptedRegulations: { type: "boolean", example: true },
                  files: {
                    type: "array",
                    items: {
                      type: "string",
                      format: "binary",
                    },
                    description: "Đính kèm tài liệu ứng tuyển (CV, bảng điểm, giấy giới thiệu...). Tối đa 5 file, mỗi file tối đa 10MB.",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Đơn đã được tiếp nhận (status = PENDING)",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Application" },
                      },
                    },
                  ],
                },
              },
            },
          },
          409: {
            description: "Email đã tồn tại trong hệ thống hoặc đã có đơn đăng ký khác đang xử lý/phê duyệt",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
      get: {
        tags: ["Applications"],
        summary: "Danh sách đơn (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "status",
            schema: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED"],
            },
          },
          {
            in: "query",
            name: "department",
            schema: { type: "string" },
            description: "Lọc bộ phận (contains)",
          },
          {
            in: "query",
            name: "position",
            schema: { type: "string" },
            description: "Lọc vị trí (contains)",
          },
          {
            in: "query",
            name: "email",
            schema: { type: "string" },
            description: "Tìm theo email (contains)",
          },
          {
            in: "query",
            name: "startDateFrom",
            schema: { type: "string", format: "date" },
            description: "Ngày bắt đầu từ",
          },
          {
            in: "query",
            name: "startDateTo",
            schema: { type: "string", format: "date" },
            description: "Ngày bắt đầu đến",
          },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["createdAt", "startDate", "fullName", "status"],
              default: "createdAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
        ],
        responses: {
          200: {
            description: "Danh sách đơn có phân trang",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Application" },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/applications/{id}": {
      get: {
        tags: ["Applications"],
        summary: "Chi tiết một đơn",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin đơn",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Application" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Applications"],
        summary: "Xoá mềm đơn (Admin only — chỉ PENDING hoặc REJECTED)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá mềm",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: {
            description: "Không thể xoá đơn đã APPROVED",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/applications/{id}/review": {
      patch: {
        tags: ["Applications"],
        summary: "Phê duyệt hoặc từ chối đơn (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReviewApplicationBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Đơn đã được xử lý",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Application" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: {
            description: "Đơn không còn ở trạng thái PENDING hoặc email của ứng viên đã được đăng ký tài khoản trước đó",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },

    // ─── Departments ─────────────────────────────────────────────────────────
    "/departments": {
      get: {
        tags: ["Departments"],
        summary: "Danh sách phòng ban (kèm danh sách vị trí)",
        description: "Public endpoint. Trả về tất cả phòng ban kèm danh sách vị trí thuộc phòng ban đó.",
        responses: {
          200: {
            description: "Danh sách phòng ban",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string", format: "uuid" },
                              name: { type: "string", example: "Engineering" },
                              positions: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    id: { type: "string", format: "uuid" },
                                    name: { type: "string", example: "Backend Intern" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/departments/{id}": {
      get: {
        tags: ["Departments"],
        summary: "Chi tiết phòng ban",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Chi tiết phòng ban" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/departments/{id}/positions": {
      get: {
        tags: ["Departments"],
        summary: "Danh sách vị trí theo phòng ban",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: {
            description: "Danh sách vị trí",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string", format: "uuid" },
                              departmentId: { type: "string", format: "uuid" },
                              name: { type: "string", example: "Backend Intern" },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },

    // ─── Task Groups ─────────────────────────────────────────────────────────
    "/task-groups": {
      get: {
        tags: ["TaskGroups"],
        summary: "Danh sách nhóm công việc",
        description: "Public endpoint. Trả về tất cả nhóm công việc kèm số lượng task trong mỗi nhóm.",
        responses: {
          200: {
            description: "Danh sách nhóm công việc",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/TaskGroup" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["TaskGroups"],
        summary: "Tạo nhóm công việc mới",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "Backend Crawl Project" },
                  description: { type: "string", example: "Dự án cào dữ liệu Backend" },
                  departmentId: { type: "string", format: "uuid", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Nhóm công việc đã được tạo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskGroup" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/task-groups/{id}": {
      get: {
        tags: ["TaskGroups"],
        summary: "Chi tiết nhóm công việc",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của nhóm công việc",
          },
        ],
        responses: {
          200: {
            description: "Chi tiết nhóm công việc",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskGroup" },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["TaskGroups"],
        summary: "Cập nhật nhóm công việc",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của nhóm công việc",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Backend Crawl Project v2" },
                  description: { type: "string", nullable: true, example: "Mô tả cập nhật" },
                  departmentId: { type: "string", format: "uuid", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Nhóm công việc đã được cập nhật",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskGroup" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["TaskGroups"],
        summary: "Xoá nhóm công việc",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của nhóm công việc",
          },
        ],
        responses: {
          200: {
            description: "Nhóm công việc đã được xoá",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: { type: "string", example: "Task group deleted successfully" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/task-groups/{id}/ai-recommendation": {
      post: {
        tags: ["TaskGroups"],
        summary: "Xem trước phân công AI cho toàn bộ Task trong nhóm công việc",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của nhóm công việc",
          },
        ],
        responses: {
          200: {
            description: "Đề xuất phân công AI cho nhóm công việc",
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/task-groups/{id}/ai-allocation/confirm": {
      post: {
        tags: ["TaskGroups"],
        summary: "Xác nhận và phân công hàng loạt cho các Task trong nhóm công việc",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của nhóm công việc",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  assignments: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["taskId", "internId"],
                      properties: {
                        taskId: { type: "string", format: "uuid" },
                        internId: { type: "string", format: "uuid" },
                        supportId: { type: "string", format: "uuid", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Đã tạo các bản ghi phân công task thành công",
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Interns ─────────────────────────────────────────────────────────────
    "/interns": {
      get: {
        tags: ["Interns"],
        summary: "Danh sách thực tập sinh (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "fullName",
            schema: { type: "string" },
            description: "Tìm theo tên (contains)",
          },
          {
            in: "query",
            name: "department",
            schema: { type: "string" },
            description: "Lọc bộ phận (contains)",
          },
          {
            in: "query",
            name: "position",
            schema: { type: "string" },
            description: "Lọc vị trí (contains)",
          },
          {
            in: "query",
            name: "status",
            schema: {
              type: "string",
              enum: ["ACTIVE", "COMPLETED", "DROPPED"],
            },
          },
          {
            in: "query",
            name: "leaderId",
            schema: { type: "string", format: "uuid" },
            description: "Lọc theo Leader",
          },
          {
            in: "query",
            name: "discordRoleGranted",
            schema: { type: "string", enum: ["true", "false"] },
          },
          {
            in: "query",
            name: "startDateFrom",
            schema: { type: "string", format: "date" },
          },
          {
            in: "query",
            name: "startDateTo",
            schema: { type: "string", format: "date" },
          },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["createdAt", "fullName", "startDate", "status"],
              default: "createdAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
        ],
        responses: {
          200: {
            description: "Danh sách hồ sơ có phân trang",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Intern" },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Interns"],
        summary: "Tạo hồ sơ thực tập sinh (Admin / Leader)",
        description:
          "Tạo sau khi đơn Application được phê duyệt. Mỗi userId chỉ có 1 hồ sơ.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateInternBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Hồ sơ đã tạo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Intern" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          409: {
            description: "User đã có hồ sơ thực tập",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/interns/direct": {
      post: {
        tags: ["Interns"],
        summary: "Tạo trực tiếp tài khoản và hồ sơ Intern (Admin only)",
        description:
          "Tạo User role INTERN và hồ sơ Intern trong cùng một database transaction. Email thông tin đăng nhập được gửi sau khi transaction thành công.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/DirectCreateInternBody",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Tài khoản và hồ sơ Intern đã được tạo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Intern" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          409: {
            description: "Email hoặc số điện thoại đã tồn tại",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/interns/{id}": {
      get: {
        tags: ["Interns"],
        summary: "Chi tiết hồ sơ theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin hồ sơ",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Intern" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Interns"],
        summary: "Cập nhật hồ sơ (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateInternBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Hồ sơ đã cập nhật",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Intern" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
      delete: {
        tags: ["Interns"],
        summary: "Xoá mềm hồ sơ (Admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá mềm",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/interns/{id}/assign-leader": {
      patch: {
        tags: ["Interns"],
        summary: "Gán hoặc đổi người hướng dẫn cho Thực tập sinh (Admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  leaderId: {
                    type: "string",
                    format: "uuid",
                    nullable: true,
                    description: "ID của Leader để gán, hoặc null để gỡ gán",
                    example: "f8b7e28b-b8dc-4a6c-9c9a-d7b1e2a8c3d9",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Gán người hướng dẫn thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Intern" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/tasks/analytics": {
      get: {
        tags: ["Tasks"],
        summary: "Thống kê công việc và hiệu suất (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "taskGroupId",
            schema: { type: "string", format: "uuid" },
            description: "ID của nhóm công việc muốn lọc số liệu thống kê"
          }
        ],
        responses: {
          200: {
            description: "Thống kê chi tiết thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            overview: {
                              type: "object",
                              properties: {
                                totalTasks: { type: "integer", example: 45 },
                                byStatus: {
                                  type: "array",
                                  items: {
                                    type: "object",
                                    properties: {
                                      status: { type: "string", example: "TODO" },
                                      count: { type: "integer", example: 12 }
                                    }
                                  }
                                },
                                byPriority: {
                                  type: "array",
                                  items: {
                                    type: "object",
                                    properties: {
                                      priority: { type: "string", example: "HIGH" },
                                      count: { type: "integer", example: 33 }
                                    }
                                  }
                                }
                              }
                            },
                            workloadByIntern: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  internId: { type: "string", format: "uuid" },
                                  internFullName: { type: "string", example: "Nguyễn Văn An" },
                                  totalTasks: { type: "integer", example: 5 },
                                  totalEstDays: { type: "number", format: "float", example: 12.5 },
                                  byStatus: {
                                    type: "array",
                                    items: {
                                      type: "object",
                                      properties: {
                                        status: { type: "string", example: "IN_PROGRESS" },
                                        count: { type: "integer", example: 2 }
                                      }
                                    }
                                  }
                                }
                              }
                            },
                            progressByPhase: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  phase: { type: "string", example: "Phase 1 - Foundation" },
                                  totalTasks: { type: "integer", example: 12 },
                                  doneTasks: { type: "integer", example: 4 },
                                  completionRate: { type: "number", format: "float", example: 0.3333 }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" }
        }
      }
    },
    "/tasks/import/template": {
      get: {
        tags: ["Tasks"],
        summary: "Tải file mẫu Excel (.xlsx) phục vụ cho import task (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Trả về file mẫu template_tasks.xlsx dưới dạng file stream binary",
            content: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                schema: {
                  type: "string",
                  format: "binary"
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" }
        }
      }
    },
    "/tasks/import/preview": {
      post: {
        tags: ["Tasks"],
        summary: "Xem trước dữ liệu import từ file Excel (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "File Excel (.xlsx hoặc .xls) chứa danh sách task"
                  },
                  taskGroupId: {
                    type: "string",
                    format: "uuid",
                    description: "ID nhóm công việc hiện có"
                  },
                  taskGroupName: {
                    type: "string",
                    description: "Tên nhóm công việc muốn tạo tự động"
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Dữ liệu xem trước từ file Excel",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            totalRows: { type: "integer", example: 45 },
                            validRows: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  excelCode: { type: "string", example: "BE1-01" },
                                  title: { type: "string", example: "Setup Express" },
                                  description: { type: "string", example: "Cấu hình dự án" },
                                  deadline: { type: "string", format: "date-time" },
                                  startDate: { type: "string", format: "date-time" },
                                  priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                                  ownerName: { type: "string", example: "BE 1" },
                                  phase: { type: "string", example: "Phase 1 - Foundation" },
                                  module: { type: "string", example: "Setup" },
                                  estDays: { type: "number", example: 1 },
                                  dependencyCodes: { type: "array", items: { type: "string" } }
                                }
                              }
                            },
                            errorRows: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  rowIndex: { type: "integer", example: 5 },
                                  excelCode: { type: "string", example: "BE1-05" },
                                  errors: { type: "array", items: { type: "string", example: "Thiếu tên Task" } }
                                }
                              }
                            },
                            internMappings: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  ownerName: { type: "string", example: "Thịnh" },
                                  internId: { type: "string", format: "uuid", nullable: true },
                                  internFullName: { type: "string", nullable: true }
                                }
                              }
                            },
                            taskGroupId: { type: "string", format: "uuid", nullable: true },
                            taskGroupName: { type: "string", nullable: true }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: { $ref: "#/components/responses/Validation" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" }
        }
      }
    },
    "/tasks/import": {
      post: {
        tags: ["Tasks"],
        summary: "Nhập hàng loạt công việc từ file Excel (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "File Excel (.xlsx hoặc .xls) chứa danh sách task"
                  },
                  taskGroupId: {
                    type: "string",
                    format: "uuid",
                    description: "ID nhóm công việc hiện có"
                  },
                  taskGroupName: {
                    type: "string",
                    description: "Tên nhóm công việc muốn tạo tự động"
                  }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: "Import thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            importedTasks: { type: "integer", example: 40 },
                            importedAssignments: { type: "integer", example: 40 },
                            importedDependencies: { type: "integer", example: 35 },
                            skippedCodes: { type: "array", items: { type: "string", example: "BE1-01" } },
                            errorRows: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  excelCode: { type: "string", example: "BE1-05" },
                                  error: { type: "string", example: "Không tìm thấy Intern" }
                                }
                              }
                            },
                            taskGroupId: { type: "string", format: "uuid", nullable: true },
                            taskGroupName: { type: "string", nullable: true }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: { $ref: "#/components/responses/Validation" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" }
        }
      }
    },

    // ─── Leaders ────────────────────────────────────────────────────────────
    "/leaders": {
      get: {
        tags: ["Leaders"],
        summary: "Danh sách leader (Admin, Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: "query", name: "fullName", schema: { type: "string" }, description: "Tìm theo tên" },
          { in: "query", name: "departmentId", schema: { type: "string", format: "uuid" }, description: "Lọc theo phòng ban" },
          { in: "query", name: "sortBy", schema: { type: "string", enum: ["createdAt", "fullName"] } },
          { $ref: "#/components/parameters/OrderParam" },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
        ],
        responses: {
          200: {
            description: "Danh sách leader",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { type: "array", items: { $ref: "#/components/schemas/Leader" } },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Leaders"],
        summary: "Tạo leader record (Admin only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateLeaderBody" } } },
        },
        responses: {
          201: { description: "Leader created" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/leaders/{id}": {
      get: {
        tags: ["Leaders"],
        summary: "Chi tiết leader",
        security: [{ BearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Leader detail" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Leaders"],
        summary: "Cập nhật leader (Admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateLeaderBody" } } },
        },
        responses: {
          200: { description: "Leader updated" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      delete: {
        tags: ["Leaders"],
        summary: "Xoá leader record (Admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Leader deleted" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "Danh sách công việc (Admin / Leader / Intern)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: "query", name: "title", schema: { type: "string" } },
          {
            in: "query",
            name: "priority",
            schema: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          },
          {
            in: "query",
            name: "createdBy",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "taskGroupId",
            schema: { type: "string", format: "uuid" },
            description: "Lọc công việc theo nhóm"
          },
          {
            in: "query",
            name: "deadlineFrom",
            schema: { type: "string", format: "date-time" },
          },
          {
            in: "query",
            name: "deadlineTo",
            schema: { type: "string", format: "date-time" },
          },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["createdAt", "title", "deadline", "priority"],
              default: "createdAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
        ],
        responses: {
          200: {
            description: "Danh sách công việc có phân trang",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Task" },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "Tạo công việc mới (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTaskBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Công việc đã được tạo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Task" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/tasks/{taskId}/ai-recommendation": {
      post: {
        tags: ["Tasks"],
        summary: "Lấy gợi ý phân bổ công việc từ AI (Admin / Leader)",
        description: "Hệ thống AI hỗ trợ phân tích Workload, Skill Match, Performance và Learning Opportunity để đề xuất Intern phù hợp nhất làm Owner & Support. Không tự động giao task — Leader xem xét và tự quyết định.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "taskId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của Task cần xin gợi ý phân bổ",
          },
        ],
        responses: {
          200: {
            description: "Đề xuất phân bổ task thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskAiRecommendationResponse" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          409: {
            description: "Task đã được phân công từ trước",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  success: false,
                  message: "Task này đã được giao cho intern. Không thể tạo đề xuất mới.",
                  code: "DUPLICATE_ENTRY",
                },
              },
            },
          },
          422: {
            description: "Không có intern nào đang active dưới sự quản lý của Leader",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  success: false,
                  message: "Không tìm thấy intern nào đang active dưới sự quản lý của bạn.",
                  code: "VALIDATION_ERROR",
                },
              },
            },
          },
        },
      },
    },
    "/tasks/{id}": {
      get: {
        tags: ["Tasks"],
        summary: "Chi tiết công việc theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin công việc",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Task" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Tasks"],
        summary: "Cập nhật công việc (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateTaskBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Công việc đã được cập nhật",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Task" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
      delete: {
        tags: ["Tasks"],
        summary: "Xoá mềm công việc (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá mềm",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── TaskAttachments ──────────────────────────────────────────────────────
    "/tasks/{taskId}/attachments": {
      get: {
        tags: ["TaskAttachments"],
        summary:
          "Lấy danh sách file đính kèm của một task (Admin / Leader / Intern)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "taskId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của Task",
          },
        ],
        responses: {
          200: {
            description: "Danh sách file đính kèm",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/TaskAttachment",
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["TaskAttachments"],
        summary: "Upload file đính kèm cho task (Admin / Leader)",
        description:
          "Gửi file qua `multipart/form-data` với field tên là `file`. Hỗ trợ: ảnh (JPEG, PNG, WEBP, GIF), PDF, DOCX, ZIP, RAR, 7z, MP4, WEBM. Dung lượng tối đa cấu hình qua `SUPABASE_STORAGE_MAX_FILE_SIZE_MB`.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "taskId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của Task",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description:
                      "File cần upload (ảnh, PDF, DOCX, ZIP, RAR, 7z, MP4, WEBM)",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "File đã được upload thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskAttachment" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description:
              "Không có file hoặc file không hợp lệ (sai định dạng / vượt dung lượng)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/tasks/{taskId}/attachments/{attachmentId}": {
      delete: {
        tags: ["TaskAttachments"],
        summary: "Xoá file đính kèm (Admin / Leader)",
        description:
          "Xoá file cả trên Supabase Storage lẫn record trong database.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "taskId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của Task",
          },
          {
            in: "path",
            name: "attachmentId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của Attachment",
          },
        ],
        responses: {
          200: {
            description: "Đã xoá file đính kèm",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: {
                          type: "string",
                          example: "Attachment deleted successfully",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── TaskAssignments ──────────────────────────────────────────────────────
    "/task-assignments": {
      get: {
        tags: ["TaskAssignments"],
        summary: "Danh sách phân công công việc",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "taskId",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "internId",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "assignedBy",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "status",
            schema: {
              type: "string",
              enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"],
            },
          },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["assignedAt", "status"],
              default: "assignedAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
        ],
        responses: {
          200: {
            description: "Danh sách phân công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/TaskAssignment",
                          },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["TaskAssignments"],
        summary: "Giao việc cho thực tập sinh (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTaskAssignmentBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Đã giao việc thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskAssignment" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Công việc quá hạn hoặc dữ liệu không hợp lệ",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          409: {
            description: "Công việc đã được giao trước đó",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/task-assignments/{id}": {
      get: {
        tags: ["TaskAssignments"],
        summary: "Chi tiết phân công công việc theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin phân công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskAssignment" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["TaskAssignments"],
        summary: "Cập nhật phân công công việc (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateTaskAssignmentBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Đã cập nhật",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskAssignment" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["TaskAssignments"],
        summary: "Xoá phân công công việc (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/task-assignments/{id}/approve": {
      patch: {
        tags: ["TaskAssignments"],
        summary: "Phê duyệt yêu cầu giao việc chéo bộ phận (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Phê duyệt giao việc thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskAssignment" },
                        message: { type: "string" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/task-assignments/{id}/reject": {
      patch: {
        tags: ["TaskAssignments"],
        summary: "Từ chối yêu cầu giao việc chéo bộ phận (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Từ chối giao việc thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },

    // ─── TaskSubmissions ──────────────────────────────────────────────────────
    "/task-submissions": {
      get: {
        tags: ["TaskSubmissions"],
        summary: "Danh sách bài nộp của thực tập sinh",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "assignmentId",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "reviewStatus",
            schema: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED"],
            },
          },
          {
            in: "query",
            name: "reviewedBy",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "internId",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "taskId",
            schema: { type: "string", format: "uuid" },
          },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["submittedAt", "reviewStatus", "attempt"],
              default: "submittedAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
        ],
        responses: {
          200: {
            description: "Danh sách bài nộp",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/TaskSubmission",
                          },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["TaskSubmissions"],
        summary: "Nộp bài (Intern only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTaskSubmissionBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Đã nộp bài thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskSubmission" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/task-submissions/thread/{assignmentId}": {
      get: {
        tags: ["TaskSubmissions"],
        summary: "Lịch sử bài nộp theo assignment",
        description:
          "Admin được xem mọi assignment. Leader chỉ được xem assignment do mình giao hoặc của intern mình quản lý. Intern chỉ được xem assignment của mình hoặc assignment mình hỗ trợ.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "assignmentId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Assignment và lịch sử các lần nộp",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            assignment: { type: "object" },
                            thread: {
                              type: "array",
                              items: {
                                $ref: "#/components/schemas/TaskSubmission",
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/Validation" },
        },
      },
    },
    "/task-submissions/{id}": {
      get: {
        tags: ["TaskSubmissions"],
        summary: "Chi tiết bài nộp theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin bài nộp",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskSubmission" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["TaskSubmissions"],
        summary:
          "Cập nhật bài nộp / Đánh giá chấm điểm (Intern / Leader / Admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateTaskSubmissionBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskSubmission" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Không thể chỉnh sửa bài nộp đã được duyệt",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["TaskSubmissions"],
        summary: "Xoá bài nộp (Intern / Leader / Admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/task-submissions/{id}/video": {
      post: {
        tags: ["TaskSubmissions"],
        summary: "Upload trực tiếp file video demo cho bài nộp (Intern only)",
        description:
          "Tải lên video demo dạng `.mp4` hoặc `.webm`. Hạn mức dung lượng tối đa cấu hình qua `SUPABASE_STORAGE_MAX_FILE_SIZE_MB`. Sau khi tải lên thành công, hệ thống tự động cập nhật trường `videoDemo` của TaskSubmission.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của TaskSubmission",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["video"],
                properties: {
                  video: {
                    type: "string",
                    format: "binary",
                    description: "File video demo (.mp4, .webm)",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Đã upload video demo và cập nhật bài nộp thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/TaskSubmission" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description:
              "File video không hợp lệ hoặc bài nộp đã được APPROVED",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/task-submissions/{submissionId}/attachments": {
      get: {
        tags: ["SubmissionAttachments"],
        summary:
          "Lấy danh sách file đính kèm của một bài nộp (Admin / Leader / Intern)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "submissionId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của TaskSubmission",
          },
        ],
        responses: {
          200: {
            description: "Danh sách file đính kèm bài nộp",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/SubmissionAttachment",
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["SubmissionAttachments"],
        summary: "Upload file đính kèm cho bài nộp (Admin / Leader / Intern)",
        description:
          "Tải lên tài liệu đính kèm dạng hình ảnh, PDF, DOCX, hoặc ZIP/RAR. Thực tập sinh chỉ được tải lên cho bài nộp của chính mình và khi bài nộp chưa được APPROVED.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "submissionId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của TaskSubmission",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description:
                      "File cần upload (ảnh, PDF, DOCX, ZIP, RAR, 7z)",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "File đã upload và đính kèm vào bài nộp",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/SubmissionAttachment",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description:
              "File không hợp lệ hoặc bài nộp đã được duyệt APPROVED",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/task-submissions/{submissionId}/attachments/{attachmentId}": {
      delete: {
        tags: ["SubmissionAttachments"],
        summary: "Xoá file đính kèm của bài nộp (Admin / Leader / Intern)",
        description:
          "Xoá file trên Supabase Storage và xoá record trong database.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "submissionId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của TaskSubmission",
          },
          {
            in: "path",
            name: "attachmentId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của Attachment",
          },
        ],
        responses: {
          200: {
            description: "Xoá thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: {
                          type: "string",
                          example: "Submission attachment deleted successfully",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Không thể chỉnh sửa hoặc xoá bài nộp đã APPROVED",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── DailyReports ────────────────────────────────────────────────────────
    "/daily-reports": {
      get: {
        tags: ["DailyReports"],
        summary: "Danh sách báo cáo hàng ngày",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "internId",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "createdAtFrom",
            schema: { type: "string", format: "date-time" },
          },
          {
            in: "query",
            name: "createdAtTo",
            schema: { type: "string", format: "date-time" },
          },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["createdAt", "internId"],
              default: "createdAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
        ],
        responses: {
          200: {
            description: "Danh sách báo cáo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/DailyReport" },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["DailyReports"],
        summary: "Tạo báo cáo hàng ngày (Intern only)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateDailyReportBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Đã tạo báo cáo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/DailyReport" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/daily-reports/{id}": {
      get: {
        tags: ["DailyReports"],
        summary: "Chi tiết báo cáo theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin báo cáo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/DailyReport" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["DailyReports"],
        summary: "Cập nhật báo cáo hàng ngày (Intern only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateDailyReportBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật báo cáo thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/DailyReport" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["DailyReports"],
        summary: "Xoá báo cáo hàng ngày (Intern / Leader / Admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá báo cáo thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/daily-reports/{id}/video": {
      post: {
        tags: ["DailyReports"],
        summary:
          "Upload trực tiếp file video demo cho báo cáo hàng ngày (Intern only)",
        description:
          "Tải lên video demo dạng `.mp4` hoặc `.webm` cho báo cáo ngày. Dung lượng tối đa cấu hình qua `SUPABASE_STORAGE_MAX_FILE_SIZE_MB`. Sau khi tải lên thành công, hệ thống tự động cập nhật trường `videoDemo` của DailyReport.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của DailyReport",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["video"],
                properties: {
                  video: {
                    type: "string",
                    format: "binary",
                    description: "File video demo (.mp4, .webm)",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Đã upload video demo và cập nhật báo cáo thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/DailyReport" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description:
              "File video không hợp lệ hoặc không có quyền sở hữu báo cáo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/daily-reports/{reportId}/attachments": {
      get: {
        tags: ["ReportAttachments"],
        summary:
          "Lấy danh sách file đính kèm của báo cáo ngày (Admin / Leader / Intern)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "reportId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của DailyReport",
          },
        ],
        responses: {
          200: {
            description: "Danh sách file đính kèm báo cáo ngày",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/ReportAttachment",
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["ReportAttachments"],
        summary:
          "Upload file đính kèm cho báo cáo ngày (Admin / Leader / Intern)",
        description:
          "Tải lên hình ảnh chụp màn hình, PDF báo cáo hoặc tài liệu nén. Thực tập sinh chỉ được đính kèm vào báo cáo của chính mình.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "reportId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của DailyReport",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "File cần upload (ảnh, PDF, ZIP/RAR, v.v.)",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "File đã upload và đính kèm thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/ReportAttachment" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "File không hợp lệ hoặc dữ liệu sai",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/daily-reports/{reportId}/attachments/{attachmentId}": {
      delete: {
        tags: ["ReportAttachments"],
        summary: "Xoá file đính kèm của báo cáo ngày (Admin / Leader / Intern)",
        description:
          "Xoá file trên Supabase Storage và xoá record tương ứng dưới DB.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "reportId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của DailyReport",
          },
          {
            in: "path",
            name: "attachmentId",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của Attachment",
          },
        ],
        responses: {
          200: {
            description: "Xoá thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: {
                          type: "string",
                          example: "Report attachment deleted successfully",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── WeeklyEvaluations ────────────────────────────────────────────────────
    "/weekly-evaluations/ai-suggestion": {
      post: {
        tags: ["WeeklyEvaluations"],
        summary: "Lấy gợi ý đánh giá tuần từ AI (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AiSuggestionRequestBody" },
            },
          },
        },
        responses: {
          200: {
            description: "AI gợi ý thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/AiSuggestionResponse",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/weekly-evaluations": {
      get: {
        tags: ["WeeklyEvaluations"],
        summary: "Danh sách đánh giá hàng tuần",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "internId",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "leaderId",
            schema: { type: "string", format: "uuid" },
          },
          { in: "query", name: "week", schema: { type: "integer" } },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["week", "totalScore", "createdAt"],
              default: "createdAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
        ],
        responses: {
          200: {
            description: "Danh sách đánh giá",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/WeeklyEvaluation",
                          },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["WeeklyEvaluations"],
        summary: "Tạo đánh giá hàng tuần (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateWeeklyEvaluationBody",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Đã tạo đánh giá thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/WeeklyEvaluation" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          409: {
            description: "Đã tồn tại đánh giá cho tuần này",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/weekly-evaluations/{id}": {
      get: {
        tags: ["WeeklyEvaluations"],
        summary: "Chi tiết đánh giá theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin đánh giá",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/WeeklyEvaluation" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["WeeklyEvaluations"],
        summary: "Cập nhật đánh giá hàng tuần (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateWeeklyEvaluationBody",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/WeeklyEvaluation" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["WeeklyEvaluations"],
        summary: "Xoá đánh giá hàng tuần (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // Intern xác nhận đã xem đánh giá
    "/weekly-evaluations/{id}/mark-reviewed": {
      patch: {
        tags: ["WeeklyEvaluations"],
        summary: "Intern xác nhận đã xem đánh giá (Intern only)",
        description: "Intern bấm xác nhận đã xem đánh giá của tuần đó. `reviewedAt` chỉ được ghi lần đầu (idempotent). Chỉ intern sở hữu đánh giá mới được gọi.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của WeeklyEvaluation",
          },
        ],
        responses: {
          200: {
            description: "Xác nhận thành công — trả về bản ghi đã cập nhật reviewedAt",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/WeeklyEvaluation" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: {
            description: "Không có quyền — không phải intern sở hữu đánh giá này",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── NotificationLogs ────────────────────────────────────────────────────
    "/notification-logs": {
      get: {
        tags: ["NotificationLogs"],
        summary: "Danh sách nhật ký gửi thông báo",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "notificationId",
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "query",
            name: "channel",
            schema: { type: "string", enum: ["WEB", "EMAIL", "DISCORD"] },
          },
          {
            in: "query",
            name: "status",
            schema: { type: "string", enum: ["SUCCESS", "FAILED"] },
          },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
          {
            in: "query",
            name: "sortBy",
            schema: { type: "string", enum: ["sentAt"], default: "sentAt" },
          },
          { $ref: "#/components/parameters/OrderParam" },
        ],
        responses: {
          200: {
            description: "Danh sách nhật ký",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/NotificationLog",
                          },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["NotificationLogs"],
        summary: "Tạo nhật ký gửi thông báo mới (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateNotificationLogBody",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Đã tạo nhật ký thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/NotificationLog" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/notification-logs/{id}": {
      get: {
        tags: ["NotificationLogs"],
        summary: "Chi tiết nhật ký gửi thông báo theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin nhật ký",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/NotificationLog" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["NotificationLogs"],
        summary: "Cập nhật nhật ký gửi thông báo (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateNotificationLogBody",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/NotificationLog" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["NotificationLogs"],
        summary: "Xoá nhật ký gửi thông báo (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Notifications ───────────────────────────────────────────────────────
    "/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "Danh sách thông báo của người dùng",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "userId",
            schema: { type: "string", format: "uuid" },
          },
          { in: "query", name: "isRead", schema: { type: "boolean" } },
          { in: "query", name: "type", schema: { type: "string" } },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
          {
            in: "query",
            name: "sortBy",
            schema: {
              type: "string",
              enum: ["createdAt"],
              default: "createdAt",
            },
          },
          { $ref: "#/components/parameters/OrderParam" },
        ],
        responses: {
          200: {
            description: "Danh sách thông báo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Notification" },
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Notifications"],
        summary: "Tạo thông báo mới (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateNotificationBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Đã tạo thông báo thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Notification" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/notifications/ticket": {
      get: {
        tags: ["Notifications"],
        summary: "Lấy One-Time Ticket để kết nối stream thông báo",
        description: "Tạo ra một ticket ID ngẫu nhiên, ngắn hạn (hạn dùng 30 giây) để client sử dụng mở luồng SSE stream an toàn mà không cần truyền trực tiếp Access Token qua URL.",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Tạo ticket thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    ticket: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" }
                  }
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/notifications/stream": {
      get: {
        tags: ["Notifications"],
        summary: "Kết nối real-time nhận thông báo (Server-Sent Events)",
        description: "Thiết lập kết nối stream HTTP EventSource để nhận thông báo thời gian thực. Xác thực bảo mật bằng tham số query '?ticket=TICKET_ID' thu được từ API `/notifications/ticket`.",
        parameters: [
          {
            in: "query",
            name: "ticket",
            required: true,
            schema: { type: "string" },
            description: "One-time Ticket ID hợp lệ và chưa hết hạn"
          }
        ],
        responses: {
          200: {
            description: "Thiết lập kết nối EventSource thành công, phản hồi với header Content-Type: text/event-stream"
          },
          401: {
            description: "Không được xác thực do thiếu ticket, ticket không hợp lệ hoặc đã hết hạn"
          }
        }
      }
    },
    "/notifications/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Đánh dấu tất cả thông báo của người dùng hiện tại là đã đọc",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: { type: "string", example: "All notifications marked as read" }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/notifications/unread-count": {
      get: {
        tags: ["Notifications"],
        summary: "Đếm chính xác tổng số thông báo chưa đọc của người dùng",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    count: { type: "integer", example: 5 }
                  }
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/notifications/clear-read": {
      delete: {
        tags: ["Notifications"],
        summary: "Xóa toàn bộ các thông báo đã đọc của người dùng hiện tại",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Dọn dẹp thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: { type: "string", example: "Read notifications cleared successfully" }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/notifications/{id}": {
      get: {
        tags: ["Notifications"],
        summary: "Chi tiết thông báo theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin thông báo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Notification" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Notifications"],
        summary: "Xoá thông báo",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Đã xoá thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Đánh dấu thông báo đã đọc",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Notification" },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── NotificationSettings ────────────────────────────────────────────────
    "/notification-settings/me": {
      get: {
        tags: ["NotificationSettings"],
        summary: "Lấy cấu hình nhận thông báo của tôi (Auto-initialization)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Thông tin cấu hình",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/NotificationSetting",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["NotificationSettings"],
        summary: "Cập nhật cấu hình nhận thông báo của tôi",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateNotificationSettingBody",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/NotificationSetting",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    // ─── NotificationTemplates ───────────────────────────────────────────────
    "/notification-templates": {
      get: {
        tags: ["NotificationTemplates"],
        summary: "Danh sách mẫu thông báo (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Danh sách mẫu",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/NotificationTemplate",
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/notification-templates/{id}": {
      get: {
        tags: ["NotificationTemplates"],
        summary: "Chi tiết mẫu thông báo theo ID (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Thông tin mẫu thông báo",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/NotificationTemplate",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["NotificationTemplates"],
        summary: "Cập nhật mẫu thông báo (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateNotificationTemplateBody",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          $ref: "#/components/schemas/NotificationTemplate",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── Stats ───────────────────────────────────────────────────────────────
    "/stats": {
      get: {
        tags: ["Stats"],
        summary: "Thống kê toàn hệ thống (Admin only)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Dữ liệu thống kê dashboard",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            interns: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                active: { type: "integer" },
                                completed: { type: "integer" },
                                dropped: { type: "integer" },
                              },
                            },
                            applications: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                pending: { type: "integer" },
                                approved: { type: "integer" },
                                rejected: { type: "integer" },
                              },
                            },
                            tasks: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                overdue: { type: "integer" },
                                byPriority: {
                                  type: "object",
                                  properties: {
                                    low: { type: "integer" },
                                    medium: { type: "integer" },
                                    high: { type: "integer" },
                                  },
                                },
                              },
                            },
                            assignments: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                byStatus: {
                                  type: "object",
                                  properties: {
                                    todo: { type: "integer" },
                                    inProgress: { type: "integer" },
                                    review: { type: "integer" },
                                    done: { type: "integer" },
                                  },
                                },
                              },
                            },
                            submissions: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                pending: { type: "integer" },
                                approved: { type: "integer" },
                                rejected: { type: "integer" },
                              },
                            },
                            dailyReports: {
                              type: "object",
                              properties: {
                                last30Days: { type: "integer" },
                                avgPerDay: { type: "number" },
                              },
                            },
                            weeklyEvaluations: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                avgScore: { type: "number" },
                              },
                            },
                            notifications: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                unread: { type: "integer" },
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/stats/my": {
      get: {
        tags: ["Stats"],
        summary: "Thống kê nhóm quản lý của Leader (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Dữ liệu thống kê trong phạm vi nhóm",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            interns: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                active: { type: "integer" },
                                completed: { type: "integer" },
                                dropped: { type: "integer" },
                              },
                            },
                            assignments: {
                              type: "object",
                              properties: { byStatus: { type: "object" } },
                            },
                            submissions: {
                              type: "object",
                              properties: {
                                pending: { type: "integer" },
                                approved: { type: "integer" },
                                rejected: { type: "integer" },
                              },
                            },
                            dailyReports: {
                              type: "object",
                              properties: {
                                last30Days: { type: "integer" },
                                avgPerDay: { type: "number" },
                              },
                            },
                            weeklyEvaluations: {
                              type: "object",
                              properties: {
                                total: { type: "integer" },
                                avgScore: { type: "number" },
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/activity-logs": {
      get: {
        tags: ["ActivityLogs"],
        summary: "Danh sách nhật ký hoạt động (Admin / Leader / Intern)",
        description: "Intern chỉ được xem nhật ký hoạt động của chính mình. Admin và Leader xem được toàn bộ.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "userId",
            schema: { type: "string", format: "uuid" },
            description: "Lọc theo ID người dùng thực hiện"
          },
          {
            in: "query",
            name: "action",
            schema: { type: "string" },
            description: "Lọc theo loại hành động (LOGIN, LOGOUT, CREATE_TASK,...)"
          },
          {
            in: "query",
            name: "targetId",
            schema: { type: "string", format: "uuid" },
            description: "Lọc theo ID đối tượng bị tác động"
          },
          {
            in: "query",
            name: "targetType",
            schema: { type: "string" },
            description: "Lọc theo loại đối tượng (Task, TaskSubmission,...)"
          },
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" },
          {
            in: "query",
            name: "sortBy",
            schema: { type: "string", enum: ["createdAt"], default: "createdAt" }
          },
          { $ref: "#/components/parameters/OrderParam" }
        ],
        responses: {
          200: {
            description: "Danh sách nhật ký hoạt động",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: { $ref: "#/components/schemas/ActivityLog" }
                        },
                        meta: { $ref: "#/components/schemas/PaginationMeta" }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/activity-logs/{id}": {
      get: {
        tags: ["ActivityLogs"],
        summary: "Chi tiết nhật ký hoạt động theo ID",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Thông tin chi tiết nhật ký hoạt động",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/ActivityLog" }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" }
        }
      }
    },

    "/applications/invites/{id}/revoke": {
      patch: {
        tags: ["Applications"],
        summary: "Thu hồi lời mời nộp đơn (Admin only)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của lời mời",
          },
        ],
        responses: {
          200: {
            description: "Lời mời đã bị thu hồi",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Không thể thu hồi (đã USED/EXPIRED/REVOKED)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/regulations/active": {
      get: {
        tags: ["Regulations"],
        summary: "Lấy quy định thực tập đang hoạt động (Public)",
        description: "Trả về nội dung quy định thực tập có trạng thái active mới nhất để ứng viên đọc và xác nhận khi điền thông tin đăng ký.",
        responses: {
          200: {
            description: "Thông tin quy định đang hoạt động",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Regulation" }
                      }
                    }
                  ]
                }
              }
            }
          },
          404: { $ref: "#/components/responses/NotFound" }
        }
      }
    },
    "/regulations": {
      get: {
        tags: ["Regulations"],
        summary: "Danh sách tất cả các quy định (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/PageParam" },
          { $ref: "#/components/parameters/LimitParam" }
        ],
        responses: {
          200: {
            description: "Danh sách quy định",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        items: {
                          type: "array",
                          items: { $ref: "#/components/schemas/Regulation" }
                        },
                        total: { type: "integer" },
                        page: { type: "integer" },
                        limit: { type: "integer" }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" }
        }
      },
      post: {
        tags: ["Regulations"],
        summary: "Tạo quy định mới (Admin)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateRegulationBody" }
            }
          }
        },
        responses: {
          201: {
            description: "Tạo quy định thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Regulation" }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" }
        }
      }
    },
    "/regulations/{id}": {
      get: {
        tags: ["Regulations"],
        summary: "Chi tiết quy định theo ID (Admin / Leader)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Chi tiết quy định",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Regulation" }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" }
        }
      },
      put: {
        tags: ["Regulations"],
        summary: "Cập nhật quy định theo ID (Admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateRegulationBody" }
            }
          }
        },
        responses: {
          200: {
            description: "Cập nhật quy định thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Regulation" }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" }
        }
      },
      delete: {
        tags: ["Regulations"],
        summary: "Xóa quy định theo ID (Admin)",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Xóa quy định thành công",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" }
              }
            }
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" }
        }
      }
    },
    "/regulations/{id}/activate": {
      patch: {
        tags: ["Regulations"],
        summary: "Kích hoạt quy định theo ID (Admin)",
        description: "Khi quy định này được kích hoạt, tất cả các quy định khác sẽ tự động được chuyển về trạng thái không hoạt động.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" }
          }
        ],
        responses: {
          200: {
            description: "Kích hoạt quy định thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: { $ref: "#/components/schemas/Regulation" }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" }
        }
      }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PDF EXPORT
    // ─────────────────────────────────────────────────────────────────────────
    "/pdf-exports/weekly-evaluations/{id}": {
      post: {
        tags: ["PDF Export"],
        summary: "Xuất báo cáo đánh giá tuần (Weekly Evaluation PDF)",
        description:
          "Leader hoặc Admin gọi API này để sinh báo cáo đánh giá tuần dưới dạng PDF.\n\n" +
          "**Luồng xử lý:**\n" +
          "1. Truy vấn dữ liệu từ PostgreSQL (evaluation, intern, tasks, daily reports, previous week)\n" +
          "2. Render HTML bằng Handlebars template\n" +
          "3. Chuyển HTML sang PDF bằng Puppeteer (Headless Chromium)\n" +
          "4. Tải PDF lên Supabase Storage\n" +
          "5. Lưu lịch sử xuất vào bảng `export_histories`\n" +
          "6. Trả về URL tải báo cáo (có hiệu lực 30 ngày)\n\n" +
          "**Nội dung báo cáo bao gồm:**\n" +
          "- Thông tin intern & leader\n" +
          "- Bảng điểm so sánh Leader vs AI (với cột chênh lệch)\n" +
          "- Progress bars từng tiêu chí\n" +
          "- Phân tích AI có cấu trúc (Strengths / Areas to Improve / Recommendation)\n" +
          "- AI Progress Analysis so sánh với tuần trước\n" +
          "- Danh sách task trong tuần kèm trạng thái\n" +
          "- Thống kê hiệu suất (completion rate, daily reports, submissions)\n" +
          "- QR code xác minh tài liệu",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "ID của WeeklyEvaluation cần xuất báo cáo",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
        ],
        responses: {
          200: {
            description: "Xuất báo cáo PDF thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        message: {
                          type: "string",
                          example: "Xuất báo cáo PDF thành công",
                        },
                        data: {
                          type: "object",
                          properties: {
                            fileUrl: {
                              type: "string",
                              format: "uri",
                              example:
                                "https://[project].supabase.co/storage/v1/object/public/report-attachments/reports/weekly/weekly-report-abc-1721234567890.pdf",
                              description: "URL công khai để tải file PDF (có hiệu lực 30 ngày)",
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: {
            description: "Không tìm thấy WeeklyEvaluation với ID đã cung cấp",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  success: false,
                  message: "Weekly Evaluation not found",
                  code: "NOT_FOUND",
                },
              },
            },
          },
          500: {
            description: "Lỗi server khi render PDF hoặc tải lên Supabase Storage",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  success: false,
                  message: "Upload to Supabase Storage failed",
                  code: "INTERNAL_SERVER_ERROR",
                },
              },
            },
          },
        },
      },
    },
    "/settings": {
      get: {
        tags: ["Settings"],
        summary: "Lấy thông tin cấu hình hệ thống (Leader/Admin/Intern)",
        description: "Lấy các thông tin cấu hình hệ thống hiện tại, bao gồm cả giới hạn dung lượng upload cho từng loại tệp.",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "Lấy cấu hình thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        AVATAR_MAX_FILE_SIZE_MB: { type: "integer", example: 2 },
                        REPORT_MAX_FILE_SIZE_MB: { type: "integer", example: 5 },
                        SUBMISSION_MAX_FILE_SIZE_MB: { type: "integer", example: 50 }
                      }
                    }
                  }
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" }
        }
      },
      put: {
        tags: ["Settings"],
        summary: "Cập nhật cấu hình hệ thống (Admin only)",
        description: "Cập nhật cấu hình hệ thống theo key. Hiện tại hỗ trợ cập nhật `SUBMISSION_MAX_FILE_SIZE_MB` trong khoảng từ 5 đến 50 MB.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["key", "value"],
                properties: {
                  key: { type: "string", example: "SUBMISSION_MAX_FILE_SIZE_MB" },
                  value: { type: "string", example: "30" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Cập nhật cấu hình thành công",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            key: { type: "string", example: "SUBMISSION_MAX_FILE_SIZE_MB" },
                            value: { type: "string", example: "30" }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          422: { $ref: "#/components/responses/Validation" }
        }
      }
    }
  },
};
