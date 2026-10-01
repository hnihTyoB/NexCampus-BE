import {
  DiscordWebhookScope,
  DiscordWebhookPurpose,
  DiscordPingStatus,
} from "../../common/constants/discord.constant";

export interface CreateDiscordWebhookDto {
  scope?: DiscordWebhookScope;
  departmentId?: string | null;
  taskGroupId?: string | null;
  purpose: DiscordWebhookPurpose;
  webhookUrl: string;
  discordRoleId?: string | null;
  threadId?: string | null;
  isEnabled?: boolean;
}

export interface UpdateDiscordWebhookDto {
  scope?: DiscordWebhookScope;
  departmentId?: string | null;
  taskGroupId?: string | null;
  purpose?: DiscordWebhookPurpose;
  webhookUrl?: string;
  discordRoleId?: string | null;
  threadId?: string | null;
  isEnabled?: boolean;
}

export interface DiscordWebhookItemDto {
  id: string;
  scope: DiscordWebhookScope;
  departmentId: string | null;
  departmentName?: string | null;
  taskGroupId: string | null;
  taskGroupName?: string | null;
  purpose: DiscordWebhookPurpose;
  webhookUrl: string; // Đã được che giấu token an toàn
  discordRoleId: string | null;
  threadId: string | null;
  isEnabled: boolean;
  lastPingAt: Date | null;
  lastStatus: DiscordPingStatus | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscordWebhookFilterQuery {
  scope?: DiscordWebhookScope;
  departmentId?: string;
  taskGroupId?: string;
  purpose?: DiscordWebhookPurpose;
  isEnabled?: boolean;
}

export interface TestDiscordWebhookDto {
  id?: string;
  webhookUrl?: string;
  discordRoleId?: string | null;
  channelName?: string;
}
