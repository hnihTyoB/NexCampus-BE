import http from "node:http";
import jwt from "jsonwebtoken";
import app from "../../../src/app";
import { prisma } from "../../../src/database/prisma.client";
import { jwtConfig } from "../../../src/config/jwt.config";
import { permissionCacheService } from "../../../src/common/services/permission-cache.service";

export interface HttpResponse<T = any> {
  status: number;
  ok: boolean;
  body: T;
  headers: Headers;
}

export interface RequestOptions {
  token?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
}

export class IntegrationTestHarness {
  private static instance: IntegrationTestHarness;
  private server: http.Server | null = null;
  private baseUrl = "";
  private adminToken = "";
  private leaderToken = "";
  private internToken = "";
  private sockets = new Set<any>();

  private activeSuites = 0;

  static getInstance(): IntegrationTestHarness {
    if (!IntegrationTestHarness.instance) {
      IntegrationTestHarness.instance = new IntegrationTestHarness();
    }
    return IntegrationTestHarness.instance;
  }

  async start(): Promise<string> {
    this.activeSuites++;
    if (this.server && this.baseUrl) {
      return this.baseUrl;
    }

    await new Promise<void>((resolve, reject) => {
      this.server = app.listen(0, "127.0.0.1", () => {
        const address = this.server?.address();
        if (address && typeof address === "object") {
          this.baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
          resolve();
        } else {
          reject(new Error("Unable to obtain port for test server"));
        }
      });

      this.server.on("connection", (socket) => {
        this.sockets.add(socket);
        socket.on("close", () => this.sockets.delete(socket));
      });

      this.server.on("error", reject);
    });

    return this.baseUrl;
  }

  async stop(): Promise<void> {
    this.activeSuites = Math.max(0, this.activeSuites - 1);
    if (this.activeSuites > 0) {
      return;
    }
    if (!this.server) return;

    for (const socket of this.sockets) {
      try {
        socket.destroy();
      } catch {}
    }
    this.sockets.clear();

    await new Promise<void>((resolve) => {
      this.server?.close(() => {
        this.server = null;
        this.baseUrl = "";
        resolve();
      });
    });
  }

  getBaseUrl(): string {
    if (!this.baseUrl) {
      throw new Error("Test server is not started yet. Call harness.start() first.");
    }
    return this.baseUrl;
  }

  generateToken(user: { id: string; email: string; role: string; roleId?: string | null }): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
        purpose: "ACCESS",
      },
      jwtConfig.accessSecret,
      { expiresIn: "2h" },
    );
  }

  async getAdminToken(): Promise<string> {
    if (this.adminToken) return this.adminToken;
    const admin = await prisma.user.findFirst({
      where: { role: { name: "ADMIN" }, isActive: true, deletedAt: null },
      include: { role: true },
    });
    if (!admin || !admin.role) {
      throw new Error("Admin user fixture not found in database");
    }
    this.adminToken = this.generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role.name,
      roleId: admin.roleId,
    });
    return this.adminToken;
  }

  async getLeaderToken(): Promise<string> {
    if (this.leaderToken) return this.leaderToken;
    const leader = await prisma.user.findFirst({
      where: { role: { name: "LEADER" }, isActive: true, deletedAt: null },
      include: { role: true },
    });
    if (!leader || !leader.role) {
      throw new Error("Leader user fixture not found in database");
    }
    this.leaderToken = this.generateToken({
      id: leader.id,
      email: leader.email,
      role: leader.role.name,
      roleId: leader.roleId,
    });
    return this.leaderToken;
  }

  async getInternToken(): Promise<string> {
    if (this.internToken) return this.internToken;
    const intern = await prisma.user.findFirst({
      where: { role: { name: "INTERN" }, isActive: true, deletedAt: null },
      include: { role: true },
    });
    if (!intern || !intern.role) {
      throw new Error("Intern user fixture not found in database");
    }
    this.internToken = this.generateToken({
      id: intern.id,
      email: intern.email,
      role: intern.role.name,
      roleId: intern.roleId,
    });
    return this.internToken;
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: any,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const baseUrl = this.getBaseUrl();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    let url = `${baseUrl}${normalizedPath}`;

    if (options.query) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    let requestBody: any = undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      requestBody = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
    });

    let responseData: any = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    } else {
      responseData = await response.text();
    }

    return {
      status: response.status,
      ok: response.ok,
      body: responseData,
      headers: response.headers,
    };
  }

  // HTTP Helper Methods
  get<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, undefined, options);
  }

  post<T = any>(path: string, body?: any, options?: RequestOptions) {
    return this.request<T>("POST", path, body, options);
  }

  put<T = any>(path: string, body?: any, options?: RequestOptions) {
    return this.request<T>("PUT", path, body, options);
  }

  patch<T = any>(path: string, body?: any, options?: RequestOptions) {
    return this.request<T>("PATCH", path, body, options);
  }

  delete<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("DELETE", path, undefined, options);
  }

  /**
   * Safe cleanup of test fixtures identified by tag or prefix
   */
  async cleanupFixturesByTag(testTag: string): Promise<void> {
    if (!testTag || testTag.length < 4) return;

    try {
      // 1. Task Submissions
      await prisma.taskSubmission.deleteMany({
        where: {
          assignment: { task: { title: { contains: testTag } } },
        },
      });

      // 2. Task Assignments
      await prisma.taskAssignment.deleteMany({
        where: {
          task: { title: { contains: testTag } },
        },
      });

      // 3. Tasks
      await prisma.task.deleteMany({
        where: { title: { contains: testTag } },
      });

      // 4. Task Groups
      await prisma.taskGroup.deleteMany({
        where: { name: { contains: testTag } },
      });

      // 5. Daily Reports
      await prisma.dailyReport.deleteMany({
        where: {
          content: { contains: testTag },
        },
      });

      // 6. Absences
      await prisma.absence.deleteMany({
        where: { reason: { contains: testTag } },
      });
      await prisma.absenceRequest.deleteMany({
        where: { reason: { contains: testTag } },
      });

      // 7. Meetings
      await prisma.meeting.deleteMany({
        where: { title: { contains: testTag } },
      });

      // 8. Weekly Evaluations
      await prisma.weeklyEvaluation.deleteMany({
        where: { comment: { contains: testTag } },
      });

      // 9. Departments & Positions
      await prisma.position.deleteMany({
        where: { name: { contains: testTag } },
      });
      await prisma.department.deleteMany({
        where: { name: { contains: testTag } },
      });

      // 10. Test Users & Tokens
      const testUsers = await prisma.user.findMany({
        where: { email: { contains: testTag } },
        select: { id: true },
      });
      const testUserIds = testUsers.map((u) => u.id);

      if (testUserIds.length > 0) {
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: testUserIds } },
        });
        await prisma.userDevice.deleteMany({
          where: { userId: { in: testUserIds } },
        });
        await prisma.verificationToken.deleteMany({
          where: { userId: { in: testUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: testUserIds } },
        });
      }

      permissionCacheService.clear();
    } catch (err: any) {
      console.warn(`[Cleanup Warning] Fixture cleanup for tag "${testTag}":`, err.message);
    }
  }
}

export const harness = IntegrationTestHarness.getInstance();
