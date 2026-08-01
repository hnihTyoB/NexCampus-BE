import { Response } from "express";
import crypto from "crypto";
import {
  NotificationEventType,
  NOTIFICATION_EVENT,
} from "../common/constants/notification-event.constant";

// Map quản lý các connection stream: userId -> Response[]
const activeClients = new Map<string, Response[]>();

// Map quản lý One-Time Ticket: ticketId -> { userId, expiresAt }
const oneTimeTickets = new Map<string, { userId: string; expiresAt: number }>();

// Dọn dẹp ticket hết hạn định kỳ mỗi phút
setInterval(() => {
  const now = Date.now();
  for (const [ticketId, ticket] of oneTimeTickets.entries()) {
    if (ticket.expiresAt < now) {
      oneTimeTickets.delete(ticketId);
    }
  }
}, 60000);

// Heartbeat gửi tín hiệu keep-alive mỗi 15 giây tới tất cả client đang kết nối
setInterval(() => {
  for (const responses of activeClients.values()) {
    for (const res of responses) {
      if (!res.writableEnded) {
        res.write(":\n\n");
      }
    }
  }
}, 15000);

export function generateOneTimeTicket(userId: string): string {
  const ticketId = crypto.randomUUID();
  oneTimeTickets.set(ticketId, {
    userId,
    expiresAt: Date.now() + 30000, // Hạn 30 giây
  });
  return ticketId;
}

export function validateOneTimeTicket(ticketId: string): string | null {
  const ticket = oneTimeTickets.get(ticketId);
  if (!ticket) return null;

  // Xóa ngay lập tức vì đây là One-Time ticket (dùng một lần)
  oneTimeTickets.delete(ticketId);

  if (ticket.expiresAt < Date.now()) {
    return null;
  }

  return ticket.userId;
}

export function subscribeNotificationStream(userId: string, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Prevent Nginx and compatible reverse proxies from buffering heartbeats.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Thêm connection vào map
  const clients = activeClients.get(userId) || [];
  clients.push(res);
  activeClients.set(userId, clients);

  // Gửi heartbeat mở màn
  res.write(": connection-established\n\n");

  res.on("close", () => {
    const currentClients = activeClients.get(userId) || [];
    const index = currentClients.indexOf(res);
    if (index !== -1) {
      currentClients.splice(index, 1);
    }

    if (currentClients.length === 0) {
      activeClients.delete(userId);
    } else {
      activeClients.set(userId, currentClients);
    }
  });
}

export function emitNotificationEventToUser(
  userId: string,
  event: { type: NotificationEventType; payload?: unknown },
) {
  const responses = activeClients.get(userId);
  if (!responses) return;

  const dataString = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of responses) {
    if (!res.writableEnded) {
      res.write(dataString);
    }
  }
}

export function emitNotificationToUser(userId: string, notification: unknown) {
  emitNotificationEventToUser(userId, {
    type: NOTIFICATION_EVENT.NEW,
    payload: notification,
  });
}
