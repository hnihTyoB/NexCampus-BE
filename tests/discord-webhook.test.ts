import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { discordWebhookService } from "../src/common/services/discord-webhook.service";
import {
  DISCORD_WEBHOOK_URL_REGEX,
  DISCORD_EMBED_COLORS,
  DISCORD_WEBHOOK_PURPOSE,
  DISCORD_WEBHOOK_SCOPE,
} from "../src/common/constants/discord.constant";
import {
  createDiscordWebhookSchema,
  updateDiscordWebhookSchema,
  testDiscordWebhookSchema,
  findAllDiscordWebhooksQuerySchema,
} from "../src/modules/integration/integration.validation";
import { discordWebhookManageService } from "../src/modules/integration/discord-webhook.service";
import { discordWebhookRepository } from "../src/modules/integration/discord-webhook.repository";
import { prisma } from "../src/database/prisma.client";

describe("Discord Webhook Notifications & Isolation Test Suite", () => {
  const validWebhookUrl =
    "https://discord.com/api/webhooks/987654321098765432/mockTokenSampleForUnitTestOnlyNotRealSecret1234";
  const validCanaryUrl =
    "https://canary.discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMN-0123456789";

  let createdWebhookId: string;
  let testDeptId: string;

  before(async () => {
    // Tìm hoặc tạo một phòng ban thử nghiệm
    let dept = await prisma.department.findFirst({
      where: { deletedAt: null },
    });
    if (!dept) {
      dept = await prisma.department.create({
        data: { name: "Test Department for Discord" },
      });
    }
    testDeptId = dept.id;
  });

  after(async () => {
    // Dọn dẹp bản ghi test nếu có
    if (createdWebhookId) {
      await prisma.discordWebhookConfig.deleteMany({
        where: { id: createdWebhookId },
      });
    }
  });

  describe("1. Regex & URL Validation", () => {
    it("should accept valid discord webhook URLs", () => {
      assert.equal(discordWebhookService.isValidWebhookUrl(validWebhookUrl), true);
      assert.equal(discordWebhookService.isValidWebhookUrl(validCanaryUrl), true);
    });

    it("should reject non-discord domains, malicious schemes, or malformed URLs", () => {
      assert.equal(
        discordWebhookService.isValidWebhookUrl("https://malicious.com/api/webhooks/123/token"),
        false,
      );
      assert.equal(
        discordWebhookService.isValidWebhookUrl("http://discord.com/api/webhooks/123/token"),
        false,
      );
      assert.equal(discordWebhookService.isValidWebhookUrl("javascript:alert(1)"), false);
      assert.equal(discordWebhookService.isValidWebhookUrl(""), false);
      assert.equal(
        discordWebhookService.isValidWebhookUrl("https://discord.com/api/webhooks/not-numeric/token"),
        false,
      );
    });

    it("should correctly mask sensitive webhook token", () => {
      const masked = discordWebhookService.maskWebhookUrl(validWebhookUrl);
      assert.ok(masked.includes("https://discord.com/api/webhooks/987654321098765432/"));
      assert.ok(masked.includes("••••••••"));
      assert.ok(!masked.includes("mockTokenSampleForUnitTestOnlyNotRealSecret1234"));
    });
  });

  describe("2. Zod Validation Schemas", () => {
    it("should validate valid create webhook payload", () => {
      const parsed = createDiscordWebhookSchema.safeParse({
        scope: "DEPARTMENT",
        departmentId: testDeptId,
        purpose: "DAILY_STANDUP",
        webhookUrl: validWebhookUrl,
        discordRoleId: "123456789012345678",
        isEnabled: true,
      });
      assert.equal(parsed.success, true);
    });

    it("should reject invalid webhook url during create", () => {
      const parsed = createDiscordWebhookSchema.safeParse({
        scope: "DEPARTMENT",
        departmentId: testDeptId,
        purpose: "DAILY_STANDUP",
        webhookUrl: "https://evil.com/webhook",
      });
      assert.equal(parsed.success, false);
    });

    it("should validate test ping schema with id or direct url", () => {
      const parsedId = testDiscordWebhookSchema.safeParse({
        id: "a0000000-0000-0000-0000-000000000001",
      });
      assert.equal(parsedId.success, true);

      const parsedUrl = testDiscordWebhookSchema.safeParse({
        webhookUrl: validWebhookUrl,
        discordRoleId: "111222333",
      });
      assert.equal(parsedUrl.success, true);
    });
  });

  describe("3. Webhook CRUD & Service Layer", () => {
    it("should create or update a webhook configuration for a department", async () => {
      const result = await discordWebhookManageService.createOrUpdateWebhook({
        scope: "DEPARTMENT",
        departmentId: testDeptId,
        purpose: "TASK_BOARD",
        webhookUrl: validWebhookUrl,
        discordRoleId: "999888777",
        isEnabled: true,
      });

      assert.ok(result.data.id);
      createdWebhookId = result.data.id;
      assert.equal(result.data.departmentId, testDeptId);
      assert.equal(result.data.purpose, "TASK_BOARD");
      assert.equal(result.data.discordRoleId, "999888777");
      assert.ok(result.data.webhookUrl.includes("••••••••")); // Đã masked
    });

    it("should list webhooks with masked URLs", async () => {
      const list = await discordWebhookManageService.listWebhooks();
      assert.ok(Array.isArray(list));
      assert.ok(list.length > 0);
      const found = list.find((w) => w.id === createdWebhookId);
      assert.ok(found);
      assert.ok(found.webhookUrl.includes("••••••••"));
    });

    it("should update an existing webhook configuration", async () => {
      const updated = await discordWebhookManageService.updateWebhook(createdWebhookId, {
        isEnabled: false,
        discordRoleId: "111222333",
      });

      assert.equal(updated.isEnabled, false);
      assert.equal(updated.discordRoleId, "111222333");
    });
  });

  describe("4. Channel Isolation & Routing Mechanism", () => {
    it("should route to department webhook when departmentId is provided", async () => {
      // Bật lại webhook test
      await prisma.discordWebhookConfig.update({
        where: { id: createdWebhookId },
        data: { isEnabled: true },
      });

      const routed = await discordWebhookService.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.TASK_BOARD,
        departmentId: testDeptId,
      });

      assert.ok(routed);
      assert.equal(routed.id, createdWebhookId);
    });

    it("should NOT leak across departments (returns null if unconfigured)", async () => {
      const fakeDeptId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
      const routed = await discordWebhookService.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.TASK_BOARD,
        departmentId: fakeDeptId,
      });

      assert.equal(routed, null);
    });

    it("should allow GLOBAL routing only for LEADERBOARD or LEADER_ALERTS", async () => {
      const routedLeaderboard = await discordWebhookService.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.LEADERBOARD,
      });
      // Đã được seed kênh vinh-danh
      assert.ok(routedLeaderboard);
      assert.equal(routedLeaderboard.scope, "GLOBAL");

      // Standup không bao giờ fallback sang global
      const routedStandup = await discordWebhookService.findWebhookForRouting({
        purpose: DISCORD_WEBHOOK_PURPOSE.DAILY_STANDUP,
      });
      assert.equal(routedStandup, null);
    });
  });

  describe("5. Embed Formatting & Colors", () => {
    it("should define standard Cyberpunk embed colors", () => {
      assert.equal(DISCORD_EMBED_COLORS.STANDUP_REMINDER, 0xfee75c);
      assert.equal(DISCORD_EMBED_COLORS.STANDUP_CLOSING, 0xed4245);
      assert.equal(DISCORD_EMBED_COLORS.TASK_CREATED, 0x5865f2);
      assert.equal(DISCORD_EMBED_COLORS.TASK_REVIEW, 0x00d26a);
      assert.equal(DISCORD_EMBED_COLORS.TASK_BLOCKED, 0xed4245);
      assert.equal(DISCORD_EMBED_COLORS.MEETING_REMINDER, 0x9b59b6);
      assert.equal(DISCORD_EMBED_COLORS.LEADERBOARD, 0xf1c40f);
      assert.equal(DISCORD_EMBED_COLORS.TEST_PING, 0x00f0ff);
    });
  });
});
