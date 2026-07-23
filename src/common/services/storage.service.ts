import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../../config/supabase.config";
import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

export class StorageService {
  private supabase: SupabaseClient;

  constructor() {
    const { url, secretKey } = supabaseConfig;

    if (!url || !secretKey) {
      throw new AppError(
        "Supabase URL or Secret Key is missing in environment variables",
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    this.supabase = createClient(url, secretKey);
  }

  async ensureBucketExists(bucket: string): Promise<void> {
    try {
      const { data, error } = await this.supabase.storage.getBucket(bucket);
      if (error || !data) {
        const { error: createError } = await this.supabase.storage.createBucket(bucket, {
          public: true,
        });
        if (createError) {
          console.error(`[StorageService] Failed to create bucket "${bucket}": ${createError.message}`);
        } else {
          console.log(`[StorageService] Automatically created missing public bucket: "${bucket}"`);
        }
      }
    } catch (err) {
      console.error(`[StorageService] Error checking/creating bucket "${bucket}":`, err);
    }
  }

  async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    await this.ensureBucketExists(bucket);

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

  /**
   * Liệt kê đệ quy toàn bộ tệp tin trong một bucket của Supabase Storage.
   * Trả về danh sách đối tượng chứa thông tin đường dẫn và thời gian khởi tạo của tệp tin.
   */
  async listAllFiles(
    bucket: string,
    folderPath: string = "",
  ): Promise<{ name: string; path: string; created_at: string }[]> {
    const files: { name: string; path: string; created_at: string }[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list(folderPath, {
          limit,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        throw new AppError(
          `Failed to list files from Supabase Storage: ${error.message}`,
          500,
          ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const item of data) {
        const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        // Nếu không có metadata, đây là một thư mục (folder) trên Supabase
        if (!item.metadata) {
          const subFiles = await this.listAllFiles(bucket, itemPath);
          files.push(...subFiles);
        } else {
          files.push({
            name: item.name,
            path: itemPath,
            created_at: item.created_at || new Date().toISOString(),
          });
        }
      }

      if (data.length < limit) {
        break;
      }
      offset += limit;
    }

    return files;
  }
}
