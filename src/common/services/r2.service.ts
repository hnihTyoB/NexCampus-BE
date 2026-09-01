import { S3Client, DeleteObjectCommand, PutObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Config } from '../../config/r2.config';

export class R2Service {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = r2Config.bucketName;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    });
  }

  /**
   * Tạo presigned PUT URL để client upload trực tiếp lên R2.
   * @param key     Đường dẫn file trong bucket (VD: avatars/userId/1234.webp)
   * @param contentType  MIME type của file (VD: image/webp)
   * @returns URL có thể dùng để PUT file trong thời gian `presignedUrlExpiresIn` giây
   */
  async getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: r2Config.presignedUrlExpiresIn,
    });
  }

  /**
   * Lấy URL public truy cập file trên R2.
   * @param key Đường dẫn file trong bucket
   */
  getPublicUrl(key: string): string {
    const base = r2Config.publicBaseUrl.replace(/\/$/, '');
    return `${base}/${key}`;
  }

  /**
   * Liệt kê TẤT CẢ các đối tượng trong bucket theo tiền tố (Prefix).
   * Sử dụng vòng lặp ContinuationToken để xử lý bucket lớn hơn 1000 objects.
   */
  async listObjects(prefix?: string): Promise<Array<{ key: string; lastModified?: Date; size?: number }>> {
    try {
      const allObjects: Array<{ key: string; lastModified?: Date; size?: number }> = [];
      let continuationToken: string | undefined = undefined;

      do {
        const command: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const response: ListObjectsV2CommandOutput = await this.client.send(command);
        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key && obj.Key.length > 0) {
              allObjects.push({
                key: obj.Key,
                lastModified: obj.LastModified,
                size: obj.Size,
              });
            }
          }
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      return allObjects;
    } catch (err: any) {
      console.warn('[R2Service] listObjects failed or bucket not accessible:', err.message);
      return [];
    }
  }

  /**
   * Xóa file khỏi R2.
   * @param key Đường dẫn file trong bucket
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    await this.client.send(command);
  }
}

