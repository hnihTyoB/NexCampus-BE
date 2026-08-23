import crypto from 'node:crypto';
import { envConfig } from '../../config/env.config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV chuẩn cho GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Trích xuất / chuẩn hóa 32-byte key từ master key string qua SHA-256.
 */
function getMasterKeyBuffer(customKey?: string): Buffer {
  const rawKey = customKey || envConfig.encryption.key;
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Mã hóa dữ liệu đối xứng bằng AES-256-GCM có kiểm tra tính toàn vẹn (Authenticated Encryption).
 *
 * Định dạng đầu ra: `<iv_hex>:<authTag_hex>:<cipherText_hex>`
 */
export function encryptSecret(plainText: string, customKey?: string): string {
  if (!plainText) {
    throw new Error('Cannot encrypt empty text');
  }

  const key = getMasterKeyBuffer(customKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Giải mã chuỗi AES-256-GCM đã mã hóa và xác minh Auth Tag.
 * Ném lỗi nếu dữ liệu bị thay đổi, giả mạo hoặc key không hợp lệ.
 */
export function decryptSecret(cipherString: string, customKey?: string): string {
  if (!cipherString || typeof cipherString !== 'string') {
    throw new Error('Invalid encrypted secret format');
  }

  const parts = cipherString.split(':');
  if (parts.length !== 3) {
    throw new Error('Encrypted string must be in format iv:authTag:cipherText');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (
    !/^[0-9a-fA-F]+$/.test(ivHex) ||
    !/^[0-9a-fA-F]+$/.test(authTagHex) ||
    !/^[0-9a-fA-F]*$/.test(encryptedHex) ||
    encryptedHex.length % 2 !== 0
  ) {
    throw new Error('Invalid hex encoding in encrypted secret');
  }

  const key = getMasterKeyBuffer(customKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Sinh API Key an toàn ngẫu nhiên và tính hash SHA-256.
 *
 * Plain text key chỉ trả về 1 lần duy nhất lúc tạo.
 * Database chỉ lưu `keyHash` và `prefix`.
 */
export function generateApiKey(prefix = 'ak_live_'): {
  plainTextKey: string;
  keyHash: string;
  displayPrefix: string;
} {
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  const plainTextKey = `${prefix}${randomBytes}`;
  const keyHash = hashApiKey(plainTextKey);
  const displayPrefix = `${prefix}${randomBytes.slice(0, 6)}...`;

  return {
    plainTextKey,
    keyHash,
    displayPrefix,
  };
}

/**
 * Băm API Key thành chuỗi SHA-256 hex để tra cứu trong database.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

/**
 * Tạo chữ ký HMAC-SHA256 chuẩn cho Webhook Payload kèm timestamp.
 *
 * Header định dạng Stripe chuẩn: `t=${timestamp},v1=${signature}`
 */
export function signHmacSha256(
  payloadString: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): { signature: string; header: string; timestamp: number } {
  const signedPayload = `${timestamp}.${payloadString}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const header = `t=${timestamp},v1=${signature}`;

  return { signature, header, timestamp };
}

/**
 * Xác thực chữ ký HMAC-SHA256 của Webhook (dành cho client hoặc test).
 * Có cơ chế kiểm tra `toleranceSeconds` để chống tấn công phát lại (Replay Attack).
 */
export function verifyHmacSignature(
  payloadString: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300, // 5 phút
): boolean {
  if (!signatureHeader || !payloadString || !secret) {
    return false;
  }

  // Parse header dạng `t=1690000000,v1=abcdef...`
  const parts = signatureHeader.split(',');
  let timestamp: number | null = null;
  let receivedSignature: string | null = null;

  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k === 't') {
      timestamp = parseInt(v, 10);
    } else if (k === 'v1') {
      receivedSignature = v;
    }
  }

  if (!timestamp || isNaN(timestamp) || !receivedSignature) {
    return false;
  }

  // Chống Replay Attack: kiểm tra độ lệch thời gian
  if (toleranceSeconds > 0) {
    const currentSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(currentSeconds - timestamp) > toleranceSeconds) {
      return false;
    }
  }

  // Tính signature mong đợi
  const signedPayload = `${timestamp}.${payloadString}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // So sánh an toàn tránh timing attack
  if (receivedSignature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8'),
  );
}
