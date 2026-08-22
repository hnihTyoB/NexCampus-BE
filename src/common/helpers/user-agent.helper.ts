import crypto from 'crypto';

/**
 * Parses raw User-Agent string to a friendly format (e.g. Chrome trên Windows)
 */
export function parseUserAgent(uaString: string | undefined): string {
  if (!uaString) return 'Thiết bị không xác định';

  let os = 'Hệ điều hành không xác định';
  let browser = 'Trình duyệt không xác định';

  const uaLower = uaString.toLowerCase();

  // Parse OS
  if (uaLower.includes('windows')) {
    os = 'Windows';
  } else if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
    os = 'macOS';
  } else if (uaLower.includes('iphone') || uaLower.includes('ipad') || uaLower.includes('ipod')) {
    os = 'iOS';
  } else if (uaLower.includes('android')) {
    os = 'Android';
  } else if (uaLower.includes('linux')) {
    os = 'Linux';
  }

  // Parse Browser
  if (uaLower.includes('zalo')) {
    browser = 'Zalo Mini App';
  } else if (uaLower.includes('edg')) {
    browser = 'Edge';
  } else if (uaLower.includes('chrome') && !uaLower.includes('opr') && !uaLower.includes('opios')) {
    browser = 'Chrome';
  } else if (uaLower.includes('safari') && !uaLower.includes('chrome') && !uaLower.includes('crios')) {
    browser = 'Safari';
  } else if (uaLower.includes('firefox') || uaLower.includes('fxios')) {
    browser = 'Firefox';
  } else if (uaLower.includes('opera') || uaLower.includes('opr')) {
    browser = 'Opera';
  }

  return `${browser} trên ${os}`;
}

/**
 * Generates SHA-256 hash from raw User-Agent string and optional device identifier
 */
export function generateDeviceHash(uaString: string | undefined, extraIdentifier?: string): string {
  const cleanUa = uaString || 'unknown';
  const data = extraIdentifier ? `${cleanUa}#${extraIdentifier}` : cleanUa;
  return crypto.createHash('sha256').update(data).digest('hex');
}

