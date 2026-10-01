import dotenv from 'dotenv';
dotenv.config();

import { DiscordWebhookService } from '../src/common/services/discord-webhook.service';
import { DISCORD_EMBED_COLORS } from '../src/common/constants/discord.constant';

async function main() {
  console.log('🚀 [NexCampus] Bắt đầu kiểm tra gửi thông báo tới Discord Webhook thực tế...');

  const discordService = new DiscordWebhookService();

  const webhooks = {
    dailyStandup:
      process.env.DISCORD_STANDUP_WEBHOOK ||
      process.env.DISCORD_WEBHOOK_URL ||
      'https://discord.com/api/webhooks/000000000000000000/placeholder-token-daily-standup',
    taskBoard:
      process.env.DISCORD_TASK_BOARD_WEBHOOK ||
      process.env.DISCORD_WEBHOOK_URL ||
      'https://discord.com/api/webhooks/000000000000000000/placeholder-token-task-board',
    meetingRoom:
      process.env.DISCORD_MEETING_WEBHOOK ||
      process.env.DISCORD_WEBHOOK_URL ||
      'https://discord.com/api/webhooks/000000000000000000/placeholder-token-meeting-room',
    vinhDanh:
      process.env.DISCORD_LEADERBOARD_WEBHOOK ||
      process.env.DISCORD_WEBHOOK_URL ||
      'https://discord.com/api/webhooks/000000000000000000/placeholder-token-leaderboard',
  };

  // 1. Test #daily-standup: Embed màu Vàng/Cam (#FEE75C) nhắc nhở đợt 1
  console.log('\n--- 1. Testing #daily-standup ---');
  const res1 = await discordService.sendEmbed({
    webhookUrl: webhooks.dailyStandup,
    content: '📢 **[TEST PING] Nhắc nhở nộp báo cáo tiến độ ngày!**',
    embeds: [
      {
        title: '⏰ Nhắc nhở Báo cáo ngày — Ban Kỹ thuật',
        description: 'Đã đến **17:30** rồi! Các bạn thực tập sinh thuộc **Ban Kỹ thuật** hãy dành 5 phút để hoàn thành báo cáo tiến độ hôm nay nhé.',
        color: DISCORD_EMBED_COLORS.STANDUP_REMINDER, // #FEE75C
        fields: [
          {
            name: '🔗 Đường dẫn nộp báo cáo',
            value: '[👉 Nhấn vào đây để nộp Daily Report](https://nexcampus.vn/intern/daily-report)',
            inline: false,
          },
          {
            name: '⏳ Hạn chót ca hôm nay',
            value: '`18:30` (Sau 18:30 hệ thống sẽ điểm danh tự động)',
            inline: true,
          },
          {
            name: '🛡️ Miễn trừ tự động',
            value: 'Intern đã nộp report hoặc có đơn nghỉ phép APPROVED được miễn chuông.',
            inline: true,
          },
        ],
        footer: { text: 'NexCampus Standup Engine • Nhắc nhở đợt 1' },
        timestamp: new Date().toISOString(),
      },
    ],
  });
  console.log(`Result Daily Standup: success=${res1.success}, status=${res1.statusCode}`);

  // 2. Test #task-board: Embed Đỏ Neon (#ED4245) Task bị tắc nghẽn (Blocked)
  console.log('\n--- 2. Testing #task-board ---');
  const res2 = await discordService.sendEmbed({
    webhookUrl: webhooks.taskBoard,
    content: '🚨 **[TEST PING] Có nhiệm vụ bị nghẽn cần tháo gỡ ngay!**',
    embeds: [
      {
        title: '🛑 CẢNH BÁO BỊ CHẶN (BLOCKED): [TASK-402] Tích hợp thanh toán VNPay Sandbox',
        description: 'Thực tập sinh **Nguyễn Văn A** đã báo cáo nhiệm vụ bị tắc nghẽn và không thể tiếp tục hoàn thành nếu không có sự hỗ trợ.',
        color: DISCORD_EMBED_COLORS.TASK_BLOCKED, // #ED4245
        fields: [
          {
            name: '⚠️ Lý do bị cản trở (Blocked Reason)',
            value: '>>> **API VNPay Sandbox trả về HTTP 503 Service Unavailable, cần Leader cấp tài khoản test mới.**',
            inline: false,
          },
          { name: '👤 Người phụ trách', value: 'Nguyễn Văn A', inline: true },
          { name: '🎯 Người phụ trách giải quyết', value: 'Leader Kỹ thuật', inline: true },
          {
            name: '🔗 Mở khóa nhiệm vụ',
            value: '[👉 Vào bảng Task để gỡ vướng mắc](https://nexcampus.vn/leader/tasks)',
            inline: false,
          },
        ],
        footer: { text: 'NexCampus Leader Alerts • Khẩn cấp' },
        timestamp: new Date().toISOString(),
      },
    ],
  });
  console.log(`Result Task Board: success=${res2.success}, status=${res2.statusCode}`);

  // 3. Test #meeting-room: Embed nhắc họp trước 15 phút
  console.log('\n--- 3. Testing #meeting-room ---');
  const res3 = await discordService.sendEmbed({
    webhookUrl: webhooks.meetingRoom,
    content: '📢 **[TEST PING] Sắp đến giờ họp!**',
    embeds: [
      {
        title: '⏰ Nhắc nhở: Cuộc họp sẽ bắt đầu sau 15 phút!',
        description: 'Cuộc họp **Sprint Review & Retrospective Sprint 34** sắp diễn ra vào lúc **17:15**. Vui lòng kiểm tra micro, camera và chuẩn bị tham dự.',
        color: DISCORD_EMBED_COLORS.MEETING_REMINDER,
        fields: [
          { name: '📋 Chủ đề cuộc họp', value: 'Sprint Review & Retrospective Sprint 34', inline: false },
          { name: '🏢 Phòng ban', value: 'Ban Kỹ thuật Phần mềm', inline: true },
          { name: '🕒 Giờ bắt đầu', value: '`17:15`', inline: true },
          { name: '🎙️ Người chủ trì', value: 'Trưởng ban Kỹ thuật', inline: true },
          {
            name: '🔗 Đường dẫn tham gia',
            value: '[👉 Nhấn vào đây để vào Google Meet](https://meet.google.com/nex-camp-us1)',
            inline: false,
          },
        ],
        footer: { text: 'NexCampus Meeting Room • Nhắc họp tự động' },
        timestamp: new Date().toISOString(),
      },
    ],
  });
  console.log(`Result Meeting Room: success=${res3.success}, status=${res3.statusCode}`);

  // 4. Test #vinh-danh: Embed Vàng Kim lấp lánh (#F1C40F)
  console.log('\n--- 4. Testing #vinh-danh ---');
  const res4 = await discordService.sendEmbed({
    webhookUrl: webhooks.vinhDanh,
    embeds: [
      {
        title: '🏆 BẢNG VÀNG VINH DANH TUẦN 39 — TOP 3 THỰC TẬP SINH XUẤT SẮC',
        description: 'Chào mừng tuần mới! Ban Quản trị **NexCampus** tự hào vinh danh 3 bạn thực tập sinh đã có thành tích xuất sắc nhất trong tuần qua:\n',
        color: DISCORD_EMBED_COLORS.LEADERBOARD, // #F1C40F
        fields: [
          {
            name: '🥇 Hạng 1: Phạm Minh Đức | Ban Kỹ thuật',
            value: '⭐ Điểm đánh giá: **98.5/100**\n*Điểm nổi bật: Tốc độ hoàn thành task vượt tiến độ, Code Clean*',
            inline: false,
          },
          {
            name: '🥈 Hạng 2: Hoàng Thùy Linh | Ban Marketing',
            value: '⭐ Điểm đánh giá: **96.0/100**\n*Điểm nổi bật: Sáng tạo nội dung TikTok xuất sắc, Báo cáo đầy đủ*',
            inline: false,
          },
          {
            name: '🥉 Hạng 3: Đỗ Quốc Anh | Ban Thiết kế UI/UX',
            value: '⭐ Điểm đánh giá: **94.2/100**\n*Điểm nổi bật: Giao diện chuẩn Cyberpunk hiện đại, Tỉ mỉ*',
            inline: false,
          },
          {
            name: '🎁 Phần thưởng',
            value: 'Mỗi bạn trong Top 3 sẽ nhận được Giấy chứng nhận Vinh danh tuần cùng phần quà từ Ban Quản trị!',
            inline: false,
          },
        ],
        footer: { text: 'NexCampus Weekly Honors • Thứ Hai 09:00 hàng tuần' },
        timestamp: new Date().toISOString(),
      },
    ],
  });
  console.log(`Result Vinh Danh: success=${res4.success}, status=${res4.statusCode}`);

  // 5. Test testPingWebhook endpoint logic
  console.log('\n--- 5. Testing testPingWebhook endpoint method ---');
  const pingRes = await discordService.testPingWebhook({
    webhookUrl: webhooks.dailyStandup,
    channelName: '#daily-standup',
  });
  console.log(`Test Ping method result: success=${pingRes.success}, status=${pingRes.statusCode}`);

  console.log('\n✨ [HOÀN TẤT] Tất cả 4 Webhooks đã nhận được tin nhắn Embed thực tế!');
}

main().catch((err) => {
  console.error('Error testing webhooks:', err);
  process.exit(1);
});
