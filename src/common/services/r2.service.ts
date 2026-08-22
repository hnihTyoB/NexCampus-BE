import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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
