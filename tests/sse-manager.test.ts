import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { SseManagerService } from "../src/common/services/sse-manager.service";
import { sseTicketService } from "../src/common/services/sse-ticket.service";
import {
  authMiddleware,
  extractTokenFromRequest,
} from "../src/middlewares/auth.middleware";
import { permissionCacheService } from "../src/common/services/permission-cache.service";

function createMockResponse() {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  let ended = false;

  return {
    headers,
    chunks,
    writableEnded: false,
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    flushHeaders() {},
    write(data: string) {
      chunks.push(data);
      return true;
    },
    end() {
      ended = true;
      this.writableEnded = true;
      return this;
    },
  };
}

function createMockRequest(
  options: {
    path?: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {},
) {
  const req: any = new EventEmitter();
  req.path = options.path || "/api/v1/notifications/stream";
  req.query = options.query || {};
  req.headers = options.headers || {};
  req.cookies = options.cookies || {};
  return req;
}

describe("Server-Sent Events (SSE) Real-Time Push Module", () => {
  let sseService: SseManagerService;

  beforeEach(() => {
    sseService = new SseManagerService();
  });

  it("1. should set standard SSE response headers upon client registration", () => {
    const res = createMockResponse();
    const req = createMockRequest();

    sseService.registerClient("user-uuid-1", res as any, req as any);

    assert.equal(res.headers["Content-Type"], "text/event-stream");
    assert.equal(res.headers["Cache-Control"], "no-cache, no-transform");
    assert.equal(res.headers["Connection"], "keep-alive");
    assert.equal(res.headers["X-Accel-Buffering"], "no");
    assert.equal(sseService.getActiveConnectionCount(), 1);
  });

  it('2. should send initial "connected" handshake event upon stream establishment', () => {
    const res = createMockResponse();
    const req = createMockRequest();

    sseService.registerClient("user-uuid-1", res as any, req as any);

    assert.ok(res.chunks.length >= 1);
    const initialPayload = res.chunks[0];
    assert.ok(initialPayload.includes("event: connected\n"));
    assert.ok(initialPayload.includes('"status":"connected"'));
  });

  it("3. should deliver targeted event to specific user (sendToUser)", () => {
    const resUser1 = createMockResponse();
    const reqUser1 = createMockRequest();
    const resUser2 = createMockResponse();
    const reqUser2 = createMockRequest();

    sseService.registerClient("user-1", resUser1 as any, reqUser1 as any);
    sseService.registerClient("user-2", resUser2 as any, reqUser2 as any);

    // Clear initial connected chunk
    resUser1.chunks.length = 0;
    resUser2.chunks.length = 0;

    sseService.sendToUser("user-1", {
      type: "notification:new",
      data: { id: "notif-1", title: "New alert for user 1" },
    });

    // User 1 receives the event
    assert.equal(resUser1.chunks.length, 1);
    assert.ok(resUser1.chunks[0].includes("event: notification:new\n"));
    assert.ok(resUser1.chunks[0].includes("New alert for user 1"));

    // User 2 must NOT receive the event
    assert.equal(resUser2.chunks.length, 0);
  });

  it("4. should broadcast event to all connected users and global clients", () => {
    const resUser1 = createMockResponse();
    const reqUser1 = createMockRequest();
    const resUser2 = createMockResponse();
    const reqUser2 = createMockRequest();

    sseService.registerClient("user-1", resUser1 as any, reqUser1 as any);
    sseService.registerClient("user-2", resUser2 as any, reqUser2 as any);

    resUser1.chunks.length = 0;
    resUser2.chunks.length = 0;

    sseService.broadcast({
      type: "system:maintenance",
      data: { enabled: true, status: "MAINTENANCE", title: "Emergency patch" },
    });

    assert.equal(resUser1.chunks.length, 1);
    assert.ok(resUser1.chunks[0].includes("event: system:maintenance\n"));
    assert.ok(resUser1.chunks[0].includes("Emergency patch"));

    assert.equal(resUser2.chunks.length, 1);
    assert.ok(resUser2.chunks[0].includes("event: system:maintenance\n"));
    assert.ok(resUser2.chunks[0].includes("Emergency patch"));
  });

  it("5. should clean up client connection and free memory on client disconnect (req close event)", () => {
    const resUser1 = createMockResponse();
    const reqUser1 = createMockRequest();

    sseService.registerClient("user-1", resUser1 as any, reqUser1 as any);
    assert.equal(sseService.getActiveConnectionCount(), 1);

    // Simulate client closing browser tab / connection
    reqUser1.emit("close");

    assert.equal(sseService.getActiveConnectionCount(), 0);

    // Subsequent sends to user-1 should not throw or send chunks
    resUser1.chunks.length = 0;
    sseService.sendToUser("user-1", { type: "test", data: {} });
    assert.equal(resUser1.chunks.length, 0);
  });

  it("6. should extract JWT token from query string ?token=... for browser EventSource support", () => {
    const reqWithQuery = createMockRequest({
      query: { token: "jwt-query-token-123" },
    });
    assert.equal(
      extractTokenFromRequest(reqWithQuery as any),
      "jwt-query-token-123",
    );

    const reqWithHeader = createMockRequest({
      headers: { authorization: "Bearer jwt-bearer-token-456" },
    });
    assert.equal(
      extractTokenFromRequest(reqWithHeader as any),
      "jwt-bearer-token-456",
    );

    const reqWithCookie = createMockRequest({
      cookies: { accessToken: "jwt-cookie-token-789" },
    });
    assert.equal(
      extractTokenFromRequest(reqWithCookie as any),
      "jwt-cookie-token-789",
    );
  });

  it("7. should close all active streams gracefully on close()", async () => {
    const resUser1 = createMockResponse();
    const reqUser1 = createMockRequest();
    const resUser2 = createMockResponse();
    const reqUser2 = createMockRequest();

    sseService.registerClient("user-1", resUser1 as any, reqUser1 as any);
    sseService.registerClient("user-2", resUser2 as any, reqUser2 as any);
    assert.equal(sseService.getActiveConnectionCount(), 2);

    await sseService.close();

    assert.equal(sseService.getActiveConnectionCount(), 0);
    assert.equal(resUser1.writableEnded, true);
    assert.equal(resUser2.writableEnded, true);
  });

  it("8. SseTicketService should generate and consume one-time ticket atomically", async () => {
    const userPayload = {
      id: "user-ticket-test-1",
      email: "test@nexcampus.com",
      role: "INTERN",
    };

    const ticket = await sseTicketService.createTicket(userPayload);
    assert.ok(ticket);
    assert.equal(typeof ticket, "string");

    // First consumption must succeed
    const consumed = await sseTicketService.validateAndConsumeTicket(ticket);
    assert.ok(consumed);
    assert.equal(consumed?.id, userPayload.id);
    assert.equal(consumed?.email, userPayload.email);

    // Replay consumption must return null (one-time ticket)
    const replay = await sseTicketService.validateAndConsumeTicket(ticket);
    assert.equal(replay, null);
  });

  it("9. authMiddleware should authenticate SSE stream requests via valid one-time ticket", async () => {
    const userPayload = {
      id: "user-ticket-test-2",
      email: "intern2@nexcampus.com",
      role: "INTERN",
    };

    // Mock user state in permissionCacheService
    const origGetUserState = permissionCacheService.getUserState;
    permissionCacheService.getUserState = async (userId: string) => {
      if (userId === "user-ticket-test-2") {
        return {
          id: userId,
          isActive: true,
          deletedAt: null,
          roleId: "role-1",
          roleName: "INTERN",
        };
      }
      return null;
    };

    try {
      const ticket = await sseTicketService.createTicket(userPayload);
      const req = createMockRequest({
        path: "/api/v2/notifications/stream",
        query: { ticket },
      });
      const res = createMockResponse();

      let nextCalled = false;
      await authMiddleware(req as any, res as any, (err?: any) => {
        assert.equal(err, undefined);
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.user?.id, userPayload.id);
      assert.equal(req.user?.email, userPayload.email);
    } finally {
      permissionCacheService.getUserState = origGetUserState;
    }
  });
});
