import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "../../config/storage.config";
import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

export class StorageService {
  private readonly client: S3Client;

  constructor() {
    const {
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl,
    } = storageConfig;

    if (
      !endpoint ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucketName ||
      !publicUrl
    ) {
      throw new AppError(
        "Cloudflare R2 storage configuration is incomplete",
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  private getObjectKey(namespace: string, path: string): string {
    const normalizedNamespace = namespace.replace(/^\/+|\/+$/g, "");
    const normalizedPath = path.replace(/^\/+/, "");

    if (!normalizedNamespace || !normalizedPath) {
      throw new AppError(
        "Storage namespace and path are required",
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    return `${normalizedNamespace}/${normalizedPath}`;
  }

  private getPublicUrl(objectKey: string): string {
    const encodedKey = objectKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${storageConfig.publicUrl}/${encodedKey}`;
  }

  /** Tính public URL từ namespace + path (không cần ký) */
  getPublicUrlFromPath(namespace: string, path: string): string {
    return this.getPublicUrl(this.getObjectKey(namespace, path));
  }

  getPathFromPublicUrl(namespace: string, fileUrl: string): string | null {
    const normalizedNamespace = namespace.replace(/^\/+|\/+$/g, "");
    const namespacePrefix = `${storageConfig.publicUrl}/${normalizedNamespace}/`;
    if (!fileUrl.startsWith(namespacePrefix)) {
      return null;
    }

    try {
      return decodeURIComponent(fileUrl.slice(namespacePrefix.length));
    } catch {
      return null;
    }
  }

  async uploadFile(
    namespace: string,
    path: string,
    buffer: Buffer,
    mimeType: string,
    options?: { contentDisposition?: string },
  ): Promise<string> {
    const objectKey = this.getObjectKey(namespace, path);

    try {
      await this.client.send(new PutObjectCommand({
        Bucket: storageConfig.bucketName,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: options?.contentDisposition,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(
        `Upload to Cloudflare R2 failed: ${message}`,
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    return this.getPublicUrl(objectKey);
  }

  async deleteFile(namespace: string, path: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: storageConfig.bucketName,
        Key: this.getObjectKey(namespace, path),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(
        `Failed to delete file from Cloudflare R2: ${message}`,
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async copyFile(
    namespace: string,
    sourcePath: string,
    destinationPath: string,
  ): Promise<string> {
    const sourceKey = this.getObjectKey(namespace, sourcePath);
    const destinationKey = this.getObjectKey(namespace, destinationPath);

    try {
      const copySource = encodeURI(
        `${storageConfig.bucketName}/${sourceKey}`,
      );

      await this.client.send(
        new CopyObjectCommand({
          Bucket: storageConfig.bucketName,
          CopySource: copySource,
          Key: destinationKey,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(
        `Failed to copy file in Cloudflare R2: ${message}`,
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    return this.getPublicUrl(destinationKey);
  }

  /**
   * Tạo Presigned PUT URL để client upload trực tiếp lên R2.
   * Trả về URL upload tạm thời, path lưu trữ (để confirm sau) và URL public của file.
   */
  async getPresignedPutUrl(
    namespace: string,
    path: string,
    mimeType: string,
    expiresInSeconds = 300,
  ): Promise<{ uploadUrl: string; filePath: string; publicUrl: string }> {
    const objectKey = this.getObjectKey(namespace, path);

    const command = new PutObjectCommand({
      Bucket: storageConfig.bucketName,
      Key: objectKey,
      ContentType: mimeType,
    });

    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(
        `Failed to generate presigned URL: ${message}`,
        500,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      uploadUrl,
      filePath: path,
      publicUrl: this.getPublicUrl(objectKey),
    };
  }

  /**
   * List all objects in a logical namespace. Returned paths exclude the
   * namespace prefix so they remain comparable with database storage paths.
   */
  async listAllFiles(
    namespace: string,
  ): Promise<{ name: string; path: string; created_at: string }[]> {
    const files: { name: string; path: string; created_at: string }[] = [];
    const normalizedNamespace = namespace.replace(/^\/+|\/+$/g, "");
    const prefix = `${normalizedNamespace}/`;
    let continuationToken: string | undefined;

    do {
      let result: ListObjectsV2CommandOutput;
      try {
        result = await this.client.send(new ListObjectsV2Command({
          Bucket: storageConfig.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new AppError(
          `Failed to list files from Cloudflare R2: ${message}`,
          500,
          ERROR_CODE.INTERNAL_SERVER_ERROR,
        );
      }

      for (const item of result.Contents ?? []) {
        if (!item.Key || !item.Key.startsWith(prefix)) continue;
        const path = item.Key.slice(prefix.length);
        if (!path) continue;
        files.push({
          name: path.split("/").pop() ?? path,
          path,
          created_at: item.LastModified?.toISOString() ?? new Date().toISOString(),
        });
      }

      continuationToken = result.IsTruncated
        ? result.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return files;
  }
}
