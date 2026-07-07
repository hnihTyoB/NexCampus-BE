import { envConfig } from '../../config/env.config';
import { geminiService } from './gemini.service';

export interface IAiProvider {
  generateJSON<T = Record<string, unknown>>(prompt: string): Promise<T>;
}

export class AiService {
  private static instance: AiService;
  private provider: IAiProvider;

  private constructor() {
    const providerType = envConfig.aiProvider.toLowerCase();

    switch (providerType) {
      case 'gemini':
        this.provider = geminiService;
        break;

      // ─── ĐƯỜNG DẪN MỞ RỘNG TRONG TƯƠNG LAI ─────────────────────────────────
      // Khi bạn muốn tích hợp nhà cung cấp khác, chỉ cần tạo service tương ứng
      // (ví dụ: openAiService implements IAiProvider) và đăng ký ở đây.
      /*
      case 'openai':
        this.provider = openAiService;
        break;
      case 'claude':
        this.provider = claudeService;
        break;
      case 'deepseek':
        this.provider = deepseekService;
        break;
      case 'openrouter':
        this.provider = openRouterService;
        break;
      */

      default:
        console.warn(`[AiService] Provider "${providerType}" không được hỗ trợ. Tự động chuyển sang Gemini.`);
        this.provider = geminiService;
    }
  }

  static getInstance(): AiService {
    if (!AiService.instance) {
      AiService.instance = new AiService();
    }
    return AiService.instance;
  }

  /**
   * Phương thức chung để gọi AI sinh dữ liệu dạng JSON.
   * Toàn bộ các module nghiệp vụ khác (như weekly-evaluation) sẽ gọi qua đây,
   * hoàn toàn độc lập với việc hệ thống đang dùng Gemini, OpenAI hay DeepSeek bên dưới.
   */
  async generateJSON<T = Record<string, unknown>>(prompt: string): Promise<T> {
    return this.provider.generateJSON<T>(prompt);
  }
}

// Export singleton instance
export const aiService = AiService.getInstance();
