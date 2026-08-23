/**
 * IP & Subnet Matching Helper
 *
 * Cung cấp các tiện ích chuẩn hóa địa chỉ IP và kiểm tra IP thuộc Whitelist / CIDR subnet.
 */

/**
 * Chuẩn hóa địa chỉ IP (loại bỏ IPv4-mapped IPv6 ::ffff:, khoảng trắng và chuyển về chữ thường)
 */
export function normalizeIp(ip: string): string {
  if (!ip || typeof ip !== 'string') return '';
  const trimmed = ip.trim().toLowerCase();
  if (trimmed.startsWith('::ffff:')) {
    const mapped = trimmed.slice(7);
    if (mapped.includes('.')) {
      return mapped;
    }
  }
  return trimmed;
}

/**
 * Chuyển đổi địa chỉ IPv4 dạng chuỗi "a.b.c.d" sang số nguyên không dấu 32-bit
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let res = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) return null;
    res = (res << 8) + num;
  }
  return res >>> 0;
}

/**
 * Kiểm tra xem một địa chỉ IPv4 có nằm trong dải CIDR (e.g., "192.168.1.0/24", "10.0.0.0/8") hay không
 */
export function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [range, prefixStr] = cidr.split('/');
  if (!range || !prefixStr) return false;

  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;

  if (prefix === 0) return true;

  const mask = ((0xffffffff << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Kiểm tra xem clientIp có khớp với bất kỳ địa chỉ / dải CIDR nào trong whitelist hay không
 *
 * Hỗ trợ:
 * - Khớp chính xác IPv4 ("127.0.0.1", "118.69.123.45")
 * - Khớp chính xác IPv6 ("::1", "fe80::1")
 * - Dải IPv4 CIDR ("10.0.0.0/8", "172.16.0.0/12", "192.168.1.0/24", "118.69.123.0/24")
 */
export function isIpInWhitelist(clientIp: string, whitelist: (string | unknown)[]): boolean {
  if (!clientIp || !Array.isArray(whitelist) || whitelist.length === 0) {
    return false;
  }

  const normalizedClient = normalizeIp(clientIp);
  if (!normalizedClient) return false;

  for (const item of whitelist) {
    if (typeof item !== 'string') continue;
    const entry = normalizeIp(item);
    if (!entry) continue;

    // 1. Khớp chính xác
    if (normalizedClient === entry) {
      return true;
    }

    // 2. Khớp CIDR subnet (chỉ áp dụng nếu entry có chứa '/')
    if (entry.includes('/')) {
      if (isIpv4InCidr(normalizedClient, entry)) {
        return true;
      }
    }
  }

  return false;
}
