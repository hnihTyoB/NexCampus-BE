import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
];

export function validateUrl(url: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('Invalid URL format', 400, ERROR_CODE.INVALID_URL);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError('Only HTTP and HTTPS URLs are allowed', 400, ERROR_CODE.INVALID_URL);
  }

  const hostname = parsed.hostname;

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new AppError(
        'Private or local IP addresses are not allowed',
        403,
        ERROR_CODE.PRIVATE_IP_BLOCKED,
      );
    }
  }

  return parsed;
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return '';
  }
}
