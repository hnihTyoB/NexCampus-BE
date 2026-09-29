import { prisma } from "../src/database/prisma.client";
import {
  DISCORD_NEON_ROLE_COLORS,
  DISCORD_WEBHOOK_PURPOSE,
  DISCORD_WEBHOOK_SCOPE,
  DISCORD_PING_STATUS,
} from "../src/common/constants/discord.constant";

import dotenv from "dotenv";
dotenv.config();

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const BASE_URL = "https://discord.com/api/v10";

if (!BOT_TOKEN) {
  console.error("❌ Lỗi: Thiếu DISCORD_BOT_TOKEN trong biến môi trường (.env)");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ Lỗi: Thiếu DISCORD_GUILD_ID trong biến môi trường (.env)");
  process.exit(1);
}

const headers = {
  Authorization: `Bot ${BOT_TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "NexCampus-Bot/2.0",
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("==================================================");
  console.log("🚀 BẮT ĐẦU TỰ ĐỘNG HÓA DISCORD CHO CÁC PHÒNG BAN");
  console.log("==================================================");

  // 1. Lấy danh sách Channels hiện có trên Guild
  const channelsRes = await fetch(`${BASE_URL}/guilds/${GUILD_ID}/channels`, { headers });
  if (!channelsRes.ok) {
    throw new Error(`Failed to fetch channels: ${channelsRes.status}`);
  }
  const channels = (await channelsRes.json()) as any[];

  // Tìm các channel cốt lõi
  const standupChannel = channels.find((c) => c.name.includes("standup") || c.name.includes("daily"));
  const taskChannel = channels.find((c) => c.name.includes("task"));
  const meetingChannel = channels.find((c) => c.name.includes("meeting"));
  const honoringChannel = channels.find((c) => c.name.includes("vinh-danh"));
  let leaderHqChannel = channels.find((c) => c.name.includes("leader") || c.name.includes("quan-tri"));

  console.log("📍 Kênh cốt lõi phát hiện:");
  console.log(` - Daily Standup: [${standupChannel?.id}] #${standupChannel?.name}`);
  console.log(` - Task Board:    [${taskChannel?.id}] #${taskChannel?.name}`);
  console.log(` - Meeting Room:  [${meetingChannel?.id}] #${meetingChannel?.name}`);
  console.log(` - Vinh Danh:     [${honoringChannel?.id}] #${honoringChannel?.name}`);

  // Nếu chưa có kênh leader-hq, tạo mới Text Channel #leader-hq
  if (!leaderHqChannel) {
    console.log("⚡ Tạo mới kênh #leader-hq...");
    const infoCategory = channels.find((c) => c.type === 4 && c.name.toLowerCase().includes("thông tin"));
    const createChRes = await fetch(`${BASE_URL}/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "leader-hq",
        type: 0, // GUILD_TEXT
        topic: "🚨 Kênh nhận cảnh báo khẩn cấp hệ thống NexCampus cho Quản trị viên & Leaders",
        parent_id: infoCategory ? infoCategory.id : undefined,
      }),
    });
    if (createChRes.ok) {
      leaderHqChannel = await createChRes.json();
      console.log(`✅ Đã tạo kênh #leader-hq [${leaderHqChannel.id}]`);
    } else {
      console.warn("⚠️ Không thể tạo kênh #leader-hq:", await createChRes.text());
    }
  } else {
    console.log(` - Leader HQ:     [${leaderHqChannel?.id}] #${leaderHqChannel?.name}`);
  }

  // 2. Lấy danh sách Webhooks hiện có trên Guild
  const webhooksRes = await fetch(`${BASE_URL}/guilds/${GUILD_ID}/webhooks`, { headers });
  const guildWebhooks = webhooksRes.ok ? ((await webhooksRes.json()) as any[]) : [];

  const getOrCreateWebhook = async (channelId: string, hookName: string): Promise<string> => {
    const existing = guildWebhooks.find((w) => w.channel_id === channelId);
    if (existing && existing.token) {
      return `https://discord.com/api/webhooks/${existing.id}/${existing.token}`;
    }
    const createRes = await fetch(`${BASE_URL}/channels/${channelId}/webhooks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: hookName }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create webhook for channel ${channelId}: ${err}`);
    }
    const created = await createRes.json();
    return `https://discord.com/api/webhooks/${created.id}/${created.token}`;
  };

  const standupWebhookUrl = standupChannel
    ? await getOrCreateWebhook(standupChannel.id, "Daily Hook")
    : "";
  const taskWebhookUrl = taskChannel
    ? await getOrCreateWebhook(taskChannel.id, "Task Hook")
    : "";
  const meetingWebhookUrl = meetingChannel
    ? await getOrCreateWebhook(meetingChannel.id, "Meeting Hook")
    : "";
  const honoringWebhookUrl = honoringChannel
    ? await getOrCreateWebhook(honoringChannel.id, "Honoring Hook")
    : "";
  const leaderHqWebhookUrl = leaderHqChannel
    ? await getOrCreateWebhook(leaderHqChannel.id, "Leader HQ Hook")
    : "";

  console.log("\n🔗 Webhook URLs sẵn sàng:");
  console.log(" - Standup Webhook:", standupWebhookUrl ? "OK" : "None");
  console.log(" - Task Webhook:   ", taskWebhookUrl ? "OK" : "None");
  console.log(" - Meeting Webhook:", meetingWebhookUrl ? "OK" : "None");
  console.log(" - Leader Webhook: ", leaderHqWebhookUrl ? "OK" : "None");

  // 3. Cấu hình Global Channels trong DB
  console.log("\n⚙️ Cập nhật Kênh Toàn Trường (Global Channels) trong DB...");

  // #vinh-danh (LEADERBOARD)
  if (honoringWebhookUrl) {
    const existingLeaderboard = await prisma.discordWebhookConfig.findFirst({
      where: { scope: DISCORD_WEBHOOK_SCOPE.GLOBAL, purpose: DISCORD_WEBHOOK_PURPOSE.LEADERBOARD },
    });
    if (existingLeaderboard) {
      await prisma.discordWebhookConfig.update({
        where: { id: existingLeaderboard.id },
        data: {
          webhookUrl: honoringWebhookUrl,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    } else {
      await prisma.discordWebhookConfig.create({
        data: {
          scope: DISCORD_WEBHOOK_SCOPE.GLOBAL,
          purpose: DISCORD_WEBHOOK_PURPOSE.LEADERBOARD,
          webhookUrl: honoringWebhookUrl,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    }
    console.log(" ✅ Đã cập nhật Global: #vinh-danh (LEADERBOARD)");
  }

  // #leader-hq (LEADER_ALERTS)
  if (leaderHqWebhookUrl) {
    const existingLeaderHq = await prisma.discordWebhookConfig.findFirst({
      where: { scope: DISCORD_WEBHOOK_SCOPE.GLOBAL, purpose: DISCORD_WEBHOOK_PURPOSE.LEADER_ALERTS },
    });
    if (existingLeaderHq) {
      await prisma.discordWebhookConfig.update({
        where: { id: existingLeaderHq.id },
        data: {
          webhookUrl: leaderHqWebhookUrl,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    } else {
      await prisma.discordWebhookConfig.create({
        data: {
          scope: DISCORD_WEBHOOK_SCOPE.GLOBAL,
          purpose: DISCORD_WEBHOOK_PURPOSE.LEADER_ALERTS,
          webhookUrl: leaderHqWebhookUrl,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    }
    console.log(" ✅ Đã cập nhật Global: #leader-hq (LEADER_ALERTS)");
  }

  // 4. Lấy danh sách Roles hiện có trên Discord Guild
  const rolesRes = await fetch(`${BASE_URL}/guilds/${GUILD_ID}/roles`, { headers });
  const existingRoles = rolesRes.ok ? ((await rolesRes.json()) as any[]) : [];

  // 5. Lấy danh sách các Department từ DB
  const departments = await prisma.department.findMany({
    orderBy: { createdAt: "asc" },
  });
  console.log(`\n🏢 Bắt đầu thiết lập cho ${departments.length} phòng ban...`);

  let colorIndex = 0;

  for (const dept of departments) {
    console.log(`\n--- XỬ LÝ PHÒNG BAN: ${dept.name} ---`);

    // A. TẠO HOẶC TÌM ROLE
    const expectedRoleName = `Ban ${dept.name.split("(")[0].trim()}`;
    let role = existingRoles.find(
      (r) =>
        r.name.toLowerCase() === expectedRoleName.toLowerCase() ||
        r.name.toLowerCase() === `ban ${dept.name.toLowerCase()}` ||
        r.name.toLowerCase().includes(dept.name.split("(")[0].trim().toLowerCase()),
    );

    let discordRoleId = role?.id;

    if (!discordRoleId) {
      console.log(`⚡ Tạo Role mới: "${expectedRoleName}"...`);
      const color = DISCORD_NEON_ROLE_COLORS[colorIndex % DISCORD_NEON_ROLE_COLORS.length];
      colorIndex++;

      const createRoleRes = await fetch(`${BASE_URL}/guilds/${GUILD_ID}/roles`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: expectedRoleName,
          color,
          hoist: false,
          mentionable: true,
        }),
      });

      if (createRoleRes.ok) {
        const newRole = await createRoleRes.json();
        discordRoleId = newRole.id;
        console.log(`✅ Đã tạo Role "${expectedRoleName}" (ID: ${discordRoleId})`);
      } else {
        console.error(`❌ Tạo Role thất bại:`, await createRoleRes.text());
      }
    } else {
      console.log(`ℹ️ Role đã tồn tại: "${role.name}" (ID: ${discordRoleId})`);
    }

    // B. TẠO HOẶC TÌM PRIVATE THREAD TRONG KÊNH STANDUP
    let threadId: string | null = null;
    const threadName = `🔒 [${dept.name.split("(")[0].trim()}] Standup`;

    if (standupChannel) {
      // Thử tạo Private Thread (type: 12)
      console.log(`⚡ Tạo Private Thread: "${threadName}" trong #${standupChannel.name}...`);
      let createThreadRes = await fetch(`${BASE_URL}/channels/${standupChannel.id}/threads`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: threadName,
          type: 12, // GUILD_PRIVATE_THREAD
          auto_archive_duration: 10080, // 7 days
          invitable: false,
        }),
      });

      // Nếu server chưa hỗ trợ Private Thread (code 50024 hoặc lỗi tier), fallback sang Public Thread (type: 11)
      if (!createThreadRes.ok) {
        const errText = await createThreadRes.text();
        console.warn(`⚠️ Private Thread không thành công (${createThreadRes.status}): ${errText}`);
        console.log("👉 Đang fallback tạo Thread công khai (type: 11)...");
        createThreadRes = await fetch(`${BASE_URL}/channels/${standupChannel.id}/threads`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: threadName,
            type: 11, // GUILD_PUBLIC_THREAD
            auto_archive_duration: 10080,
          }),
        });
      }

      if (createThreadRes.ok) {
        const threadData = await createThreadRes.json();
        threadId = threadData.id;
        console.log(`✅ Đã tạo Thread thành công: "${threadData.name}" (ID: ${threadId})`);

        // Gửi thông điệp chào mừng khởi tạo vào Thread
        try {
          await fetch(`${BASE_URL}/channels/${threadId}/messages`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              embeds: [
                {
                  title: `🚀 Luồng Báo Cáo Standup: ${dept.name}`,
                  description: `Luồng thảo luận & điểm danh báo cáo tiến độ tự động hàng ngày dành riêng cho **${expectedRoleName}** ${discordRoleId ? `<@&${discordRoleId}>` : ""}.\n\nHệ thống NexCampus sẽ tự động nhắc nhở và tổng hợp dữ liệu tại đây.`,
                  color: 0x00f0ff,
                  fields: [
                    { name: "Phòng ban", value: dept.name, inline: true },
                    { name: "Trạng thái", value: "🟢 Đã kết nối tự động", inline: true },
                  ],
                  footer: {
                    text: "NexCampus Automation Bot • Zero-Touch",
                  },
                  timestamp: new Date().toISOString(),
                },
              ],
            }),
          });
        } catch (e: any) {
          console.warn("Không thể gửi tin nhắn chào mừng vào thread:", e.message);
        }
      } else {
        console.error(`❌ Tạo Thread thất bại:`, await createThreadRes.text());
      }
    }

    // C. CẬP NHẬT CẤU HÌNH WEBHOOKS CHO PHÒNG BAN TRONG CƠ SỞ DỮ LIỆU
    // Cần 3 records: DAILY_STANDUP, TASK_BOARD, MEETING_ROOM
    console.log(`💾 Cập nhật 3 kênh Webhook trong DB cho phòng ban...`);

    // 1. DAILY_STANDUP
    const existingStandup = await prisma.discordWebhookConfig.findFirst({
      where: { departmentId: dept.id, purpose: DISCORD_WEBHOOK_PURPOSE.DAILY_STANDUP },
    });
    if (existingStandup) {
      await prisma.discordWebhookConfig.update({
        where: { id: existingStandup.id },
        data: {
          webhookUrl: standupWebhookUrl || existingStandup.webhookUrl,
          discordRoleId: discordRoleId || existingStandup.discordRoleId,
          threadId: threadId || existingStandup.threadId,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    } else {
      await prisma.discordWebhookConfig.create({
        data: {
          scope: DISCORD_WEBHOOK_SCOPE.DEPARTMENT,
          departmentId: dept.id,
          purpose: DISCORD_WEBHOOK_PURPOSE.DAILY_STANDUP,
          webhookUrl: standupWebhookUrl,
          discordRoleId,
          threadId,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    }

    // 2. TASK_BOARD
    const existingTask = await prisma.discordWebhookConfig.findFirst({
      where: { departmentId: dept.id, purpose: DISCORD_WEBHOOK_PURPOSE.TASK_BOARD },
    });
    if (existingTask) {
      await prisma.discordWebhookConfig.update({
        where: { id: existingTask.id },
        data: {
          webhookUrl: taskWebhookUrl || existingTask.webhookUrl,
          discordRoleId: discordRoleId || existingTask.discordRoleId,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    } else {
      await prisma.discordWebhookConfig.create({
        data: {
          scope: DISCORD_WEBHOOK_SCOPE.DEPARTMENT,
          departmentId: dept.id,
          purpose: DISCORD_WEBHOOK_PURPOSE.TASK_BOARD,
          webhookUrl: taskWebhookUrl,
          discordRoleId,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    }

    // 3. MEETING_ROOM
    const existingMeeting = await prisma.discordWebhookConfig.findFirst({
      where: { departmentId: dept.id, purpose: DISCORD_WEBHOOK_PURPOSE.MEETING_ROOM },
    });
    if (existingMeeting) {
      await prisma.discordWebhookConfig.update({
        where: { id: existingMeeting.id },
        data: {
          webhookUrl: meetingWebhookUrl || existingMeeting.webhookUrl,
          discordRoleId: discordRoleId || existingMeeting.discordRoleId,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    } else {
      await prisma.discordWebhookConfig.create({
        data: {
          scope: DISCORD_WEBHOOK_SCOPE.DEPARTMENT,
          departmentId: dept.id,
          purpose: DISCORD_WEBHOOK_PURPOSE.MEETING_ROOM,
          webhookUrl: meetingWebhookUrl,
          discordRoleId,
          isEnabled: true,
          lastStatus: DISCORD_PING_STATUS.SUCCESS,
          lastPingAt: new Date(),
        },
      });
    }

    console.log(`✅ Hoàn tất cấu hình 3 kênh cho: ${dept.name}`);
    await sleep(500); // Tránh rate limit của Discord API
  }

  console.log("\n==================================================");
  console.log("🎉 HOÀN TẤT TOÀN BỘ TIẾN TRÌNH TỰ ĐỘNG HÓA DISCORD!");
  console.log("==================================================");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
