import { discordConfig } from "../../config/discord.config";

export class DiscordService {
  static async sendMessage(title: string, content: string): Promise<boolean> {
    if (!discordConfig.webhookUrl) {
      console.warn(
        "[DiscordService] Webhook URL not configured — skipping Discord notification.",
      );
      return false;
    }

    try {
      const response = await fetch(discordConfig.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title,
              description: content,
              color: 0x4f46e5, // Indigo
              footer: { text: "NexCampus Notification System" },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!response.ok) {
        console.error(
          "[DiscordService] Webhook returned status:",
          response.status,
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("[DiscordService] Failed to send webhook:", error);
      return false;
    }
  }
}
