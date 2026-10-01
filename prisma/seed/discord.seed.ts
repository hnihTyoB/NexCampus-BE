import { PrismaClient } from "@prisma/client";

export async function seedDiscordWebhooks(prisma: PrismaClient) {
  console.log("\n[Discord] Khởi tạo Cấu hình Discord Webhook Phân Luồng...");

  // 1. Kênh toàn trường: Vinh danh Top tuần (Leaderboard)
  const vinhDanhUrl =
    process.env.DISCORD_LEADERBOARD_WEBHOOK ||
    "https://discord.com/api/webhooks/000000000000000000/placeholder-token-leaderboard";

  const existingGlobal = await prisma.discordWebhookConfig.findFirst({
    where: {
      scope: "GLOBAL",
      purpose: "LEADERBOARD",
    },
  });

  if (existingGlobal) {
    await prisma.discordWebhookConfig.update({
      where: { id: existingGlobal.id },
      data: { webhookUrl: vinhDanhUrl, isEnabled: true },
    });
  } else {
    await prisma.discordWebhookConfig.create({
      data: {
        scope: "GLOBAL",
        purpose: "LEADERBOARD",
        webhookUrl: vinhDanhUrl,
        isEnabled: true,
      },
    });
  }

  // 2. Tìm phòng ban Kỹ thuật phần mềm (hoặc phòng ban đầu tiên)
  const engineeringDept =
    (await prisma.department.findFirst({
      where: { name: { contains: "Kỹ thuật" } },
    })) || (await prisma.department.findFirst());

  if (engineeringDept) {
    const standupUrl =
      process.env.DISCORD_STANDUP_WEBHOOK ||
      "https://discord.com/api/webhooks/000000000000000000/placeholder-token-standup";
    const taskBoardUrl =
      process.env.DISCORD_TASK_BOARD_WEBHOOK ||
      "https://discord.com/api/webhooks/000000000000000000/placeholder-token-task-board";
    const meetingRoomUrl =
      process.env.DISCORD_MEETING_WEBHOOK ||
      "https://discord.com/api/webhooks/000000000000000000/placeholder-token-meeting-room";

    const deptConfigs = [
      { purpose: "DAILY_STANDUP" as const, url: standupUrl },
      { purpose: "TASK_BOARD" as const, url: taskBoardUrl },
      { purpose: "MEETING_ROOM" as const, url: meetingRoomUrl },
    ];

    for (const item of deptConfigs) {
      const existing = await prisma.discordWebhookConfig.findFirst({
        where: {
          departmentId: engineeringDept.id,
          purpose: item.purpose,
        },
      });

      if (existing) {
        await prisma.discordWebhookConfig.update({
          where: { id: existing.id },
          data: { webhookUrl: item.url, isEnabled: true },
        });
      } else {
        await prisma.discordWebhookConfig.create({
          data: {
            scope: "DEPARTMENT",
            departmentId: engineeringDept.id,
            purpose: item.purpose,
            webhookUrl: item.url,
            isEnabled: true,
          },
        });
      }
    }
  }

  console.log("✔ Hoàn tất cấu hình 4 Webhook Discord phân luồng.");
}
