import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiConfig } from "../../config/ai.config";
import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

import { IAiProvider } from "./ai.service";

export class GeminiService implements IAiProvider {
  private static instance: GeminiService;
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;

  private constructor() {
    this.apiKeys = aiConfig.gemini.apiKeys;
    if (this.apiKeys.length > 0) {
      console.log(
        `[GeminiService] Initialized with ${this.apiKeys.length} API keys for rotation/backup.`,
      );
    } else {
      console.warn(
        "[GeminiService] No GEMINI_API_KEY configured — AI features will be unavailable.",
      );
    }
  }

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Gọi Gemini và ép buộc trả về JSON hợp lệ.
   * Có hỗ trợ xoay tua API key tự động trong pool nếu gặp lỗi quota hoặc key hỏng.
   */
  async generateJSON<T = Record<string, unknown>>(prompt: string): Promise<T> {
    if (this.apiKeys.length === 0) {
      throw new AppError(
        "Gemini API key chưa được cấu hình. Vui lòng thêm GEMINI_API_KEY hoặc GEMINI_API_KEYS vào file .env.",
        502,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    let lastError: unknown = null;
    const attempts = this.apiKeys.length;

    // Duyệt qua tất cả các key trong pool để thử
    for (let i = 0; i < attempts; i++) {
      const activeIndex = this.currentKeyIndex;
      const apiKey = this.apiKeys[activeIndex];

      try {
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({
          model: "gemini-flash-latest",
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const cleaned = text
          .replace(/^```(?:json)?\n?/i, "")
          .replace(/\n?```$/i, "")
          .trim();

        try {
          const parsed = JSON.parse(cleaned) as T;
          return parsed;
        } catch (parseError) {
          console.error(
            "[GeminiService] Raw text response before parse error:",
            text,
          );
          throw parseError;
        }
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[GeminiService] Key index ${activeIndex} failed:`,
          message,
        );

        // Nếu gặp lỗi rate limit (Quota) hoặc Key hỏng, xoay sang key tiếp theo trong danh sách
        if (
          message.includes("RESOURCE_EXHAUSTED") ||
          message.includes("quota") ||
          message.includes("API_KEY_INVALID") ||
          message.includes("API key not valid") ||
          message.includes("FETCH_ERROR")
        ) {
          this.currentKeyIndex =
            (this.currentKeyIndex + 1) % this.apiKeys.length;
          console.log(
            `🔄 [GeminiService] Chuyển API Key sang index ${this.currentKeyIndex} (Backup Key)...`,
          );
        } else {
          // Lỗi khác không liên quan đến Quota/Key thì throw luôn
          throw error;
        }
      }
    }

    // Để module nghiệp vụ tự tạo fallback phù hợp với đúng response contract.
    const finalMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    console.error(
      "[GeminiService] All API keys in the pool failed:",
      finalMessage,
    );
    throw new AppError(
      "Dịch vụ AI hiện không khả dụng. Hệ thống sẽ dùng kết quả dự phòng.",
      503,
      ERROR_CODE.DEPENDENCY_ERROR,
    );
  }
}

// Export singleton instance
export const geminiService = GeminiService.getInstance();
