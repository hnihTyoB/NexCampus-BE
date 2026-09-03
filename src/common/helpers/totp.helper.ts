import crypto from 'node:crypto';
import { hashToken } from './crypto.helper';

// Bảng mã chuẩn RFC 4648 Base32 (không phân biệt hoa thường, chỉ gồm A-Z và 2-7)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Mã hóa Buffer sang chuỗi Base32 chuẩn RFC 4648 (dùng cho Google Authenticator).
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Giải mã chuỗi Base32 sang Buffer.
 * Tự động loại bỏ khoảng trắng, dấu gạch nối và chuẩn hóa chữ in hoa.
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.replace(/[\s-=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${clean[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Sinh khóa bí mật TOTP ngẫu nhiên (20 bytes = 160-bit theo khuyến nghị RFC 4226/6238).
 * Kết quả trả về là chuỗi Base32 chuẩn dài 32 ký tự.
 */
export function generateTotpSecret(bytes = 20): string {
  const randomBuffer = crypto.randomBytes(bytes);
  return base32Encode(randomBuffer);
}

/**
 * Tạo đường dẫn URI chuẩn `otpauth://` để ứng dụng Authenticator có thể quét QR Code.
 */
export function generateOtpauthUri(options: {
  issuer: string;
  accountName: string;
  secret: string;
}): string {
  const { issuer, accountName, secret } = options;
  const cleanIssuer = encodeURIComponent(issuer.trim());
  const cleanAccount = encodeURIComponent(accountName.trim());
  const cleanSecret = secret.replace(/[\s-]/g, '').toUpperCase();

  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${cleanSecret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Tính toán mã số 6 chữ số TOTP tại một mốc thời gian cụ thể theo chuẩn RFC 6238 / RFC 4226.
 */
export function generateTotpCode(
  secret: string,
  timestamp: number = Date.now(),
  period = 30,
  digits = 6,
): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestamp / 1000 / period);

  // 8-byte big-endian counter buffer
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(counter));

  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();

  // Dynamic truncation (RFC 4226 phần 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binaryCode % Math.pow(10, digits)).toString().padStart(digits, '0');
  return otp;
}

/**
 * Xác thực mã số TOTP với cơ chế bù lệch giờ (Window Drift).
 * `window = 1` cho phép lệch $\pm 1$ bước (tức lệch $\pm 30$ giây trước hoặc sau).
 * Sử dụng `crypto.timingSafeEqual` để chống tấn công Timing Attack.
 */
export function verifyTotpCode(
  secret: string,
  token: string,
  window = 1,
  timestamp: number = Date.now(),
  period = 30,
): boolean {
  const cleanToken = token.trim();
  if (!/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  try {
    for (let step = -window; step <= window; step++) {
      const stepTime = timestamp + step * period * 1000;
      const expectedOtp = generateTotpCode(secret, stepTime, period, 6);

      const bufToken = Buffer.from(cleanToken, 'utf8');
      const bufExpected = Buffer.from(expectedOtp, 'utf8');

      if (bufToken.length === bufExpected.length && crypto.timingSafeEqual(bufToken, bufExpected)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Sinh danh sách mã dự phòng khẩn cấp (Backup Recovery Codes).
 * Định dạng: `xxxx-xxxx` (8 ký tự hex viết hoa có gạch nối).
 * Trả về:
 *  - `plainCodes`: Mã rõ ràng hiển thị 1 lần duy nhất cho người dùng lưu trữ.
 *  - `hashedCodes`: Mã đã băm bằng SHA-256 để lưu an toàn trong cơ sở dữ liệu.
 */
export function generateBackupCodes(count = 8): {
  plainCodes: string[];
  hashedCodes: string[];
} {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formattedCode = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    plainCodes.push(formattedCode);
    hashedCodes.push(hashToken(formattedCode));
  }

  return { plainCodes, hashedCodes };
}
