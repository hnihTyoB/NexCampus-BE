import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { envConfig } from "../../config/env.config";
import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

export class StorageService {
  private supabase: SupabaseClient;

  constructor() {
    const { url, secretKey } = envConfig.supabase;

    if (!url || !secretKey) {
      throw new Error(
        "Supabase URL or Secret Key is missing in environment variables",
      );
    }

    this.supabase = createClient(url, secretKey);
  }

  async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new AppError(
        `Upload to Supabase Storage failed: ${error.message}`,
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(bucket).remove([path]);

    if (error) {
      throw new AppError(
        `Failed to delete file from Supabase Storage: ${error.message}`,
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
