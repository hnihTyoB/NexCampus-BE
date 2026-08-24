import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { getVietnamDayRange, formatVietnamDate, formatVietnamDateTime } from '../src/common/helpers/date.helper';
import { toSlug } from '../src/common/helpers/slug.helper';

import { generateDeviceHash } from '../src/common/helpers/user-agent.helper';
import {
  isPublicHttpUrl,
  isPrivateOrReservedHost,
  isPrivateOrReservedIp,
  isValidHttpUrl,
  extractDomain,
  resolveAndValidateDns,
  resolveSafeRedirectChain,
} from '../src/common/helpers/url.helper';

describe('Decimal Invariants & Precision', () => {
  it('should accurately calculate additions without floating point precision issues using Decimal', () => {
    let balance = new Prisma.Decimal('0.00');
    
    // Add 1,000 increments of 0.10
    const increment = new Prisma.Decimal('0.10');
    for (let i = 0; i < 1000; i++) {
      balance = balance.plus(increment);
    }

    assert.equal(balance.toString(), '100');
    assert.equal(balance.toFixed(2), '100.00');
  });

  it('should accurately handle addition, subtraction and transfer operations with Decimal', () => {
    let balanceA = new Prisma.Decimal('500.00');
    let balanceB = new Prisma.Decimal('200.00');

    // Add to Balance A: +150.75
    const addition = new Prisma.Decimal('150.75');
    balanceA = balanceA.plus(addition);
    assert.equal(balanceA.toFixed(2), '650.75');

    // Subtract from Balance A: -50.25
    const deduction = new Prisma.Decimal('50.25');
    balanceA = balanceA.minus(deduction);
    assert.equal(balanceA.toFixed(2), '600.50');

    // Transfer from Balance A to Balance B: 100.50
    const transfer = new Prisma.Decimal('100.50');
    balanceA = balanceA.minus(transfer);
    balanceB = balanceB.plus(transfer);

    assert.equal(balanceA.toFixed(2), '500.00');
    assert.equal(balanceB.toFixed(2), '300.50');
  });
});

describe('Timezone & Date Helper (Asia/Ho_Chi_Minh - UTC+7)', () => {
  it('should correctly determine day range for Vietnam business date 2026-08-22', () => {
    const { startOfDay, endOfDay } = getVietnamDayRange('2026-08-22');
    
    // 2026-08-22 00:00:00+07:00 is 2026-08-21 17:00:00 UTC
    assert.equal(startOfDay.toISOString(), '2026-08-21T17:00:00.000Z');
    
    // 2026-08-22 23:59:59.999+07:00 is 2026-08-22 16:59:59.999 UTC
    assert.equal(endOfDay.toISOString(), '2026-08-22T16:59:59.999Z');
  });

  it('should format UTC timestamp back to correct Vietnam date string YYYY-MM-DD', () => {
    // 2026-08-21 18:00:00 UTC is 2026-08-22 01:00:00 in Vietnam (early morning)
    const earlyMorning = new Date('2026-08-21T18:00:00.000Z');
    assert.equal(formatVietnamDate(earlyMorning), '2026-08-22');

    // 2026-08-22 16:30:00 UTC is 2026-08-22 23:30:00 in Vietnam (late night)
    const lateNight = new Date('2026-08-22T16:30:00.000Z');
    assert.equal(formatVietnamDate(lateNight), '2026-08-22');
  });

  it('should format date with formatVietnamDateTime in Asia/Ho_Chi_Minh timezone', () => {
    // 2026-08-24 07:00:00 UTC is 14:00:00 in Vietnam
    const sampleDate = new Date('2026-08-24T07:00:00.000Z');
    const formatted = formatVietnamDateTime(sampleDate);
    assert.ok(formatted.includes('2026'));
    assert.ok(formatted.includes('14:00') || formatted.includes('2:00'));
  });
});


describe('Helpers & Sanitization', () => {
  it('should convert Vietnamese accented strings into clean slug', () => {
    const slug = toSlug('Quản trị Người dùng & Hệ thống - Tháng 8/2026');
    assert.equal(slug, 'quan-tri-nguoi-dung-he-thong-thang-8-2026');
  });

  it('should generate robust SHA-256 device hash', () => {
    const hash1 = generateDeviceHash('Mozilla/5.0 Chrome/120.0', 'device-A');
    const hash2 = generateDeviceHash('Mozilla/5.0 Chrome/120.0', 'device-B');
    
    assert.equal(hash1.length, 64);
    assert.notEqual(hash1, hash2);
  });
});

describe('URL Helper — isPublicHttpUrl', () => {
  // Tất cả test kiểm tra private-IP blocking dùng { allowPrivate: false }
  // để mô phỏng behaviour production (NODE_ENV=production).
  // Trong dev (NODE_ENV != 'production') mặc định allowPrivate = true.

  // ── Valid public URLs ────────────────────────────────────────────────────
  it('should return true for valid public HTTPS URL', () => {
    assert.equal(isPublicHttpUrl('https://example.com/avatar.jpg'), true);
  });

  it('should return true for valid public HTTP URL with query string', () => {
    assert.equal(isPublicHttpUrl('http://open.example.org/path?q=1'), true);
  });

  it('should return true for valid public URL with subdomain and ccTLD', () => {
    assert.equal(isPublicHttpUrl('https://cdn.example.co.uk/img.png'), true);
  });

  // ── allowPrivate option ──────────────────────────────────────────────────
  it('should return true for localhost when allowPrivate: true (dev mode)', () => {
    assert.equal(isPublicHttpUrl('http://localhost/app', { allowPrivate: true }), true);
  });

  it('should return true for private IP when allowPrivate: true (dev mode)', () => {
    assert.equal(isPublicHttpUrl('http://192.168.1.100/api', { allowPrivate: true }), true);
  });

  // ── Localhost / loopback (production: allowPrivate: false) ───────────────
  it('should return false for http://localhost in production mode', () => {
    assert.equal(isPublicHttpUrl('http://localhost/evil', { allowPrivate: false }), false);
  });

  it('should return false for http://127.0.0.1 in production mode', () => {
    assert.equal(isPublicHttpUrl('http://127.0.0.1:8080/', { allowPrivate: false }), false);
  });

  it('should return false for http://127.255.255.255 (loopback range)', () => {
    assert.equal(isPublicHttpUrl('http://127.255.255.255/', { allowPrivate: false }), false);
  });

  it('should return false for http://0.0.0.0', () => {
    assert.equal(isPublicHttpUrl('http://0.0.0.0/', { allowPrivate: false }), false);
  });

  // ── Private IPv4 ranges ──────────────────────────────────────────────────
  it('should return false for 10.x private range', () => {
    assert.equal(isPublicHttpUrl('http://10.0.0.1/secret', { allowPrivate: false }), false);
  });

  it('should return false for 172.16.x (private class B start)', () => {
    assert.equal(isPublicHttpUrl('http://172.16.0.5/api', { allowPrivate: false }), false);
  });

  it('should return false for 172.31.x (private class B end)', () => {
    assert.equal(isPublicHttpUrl('http://172.31.255.255/', { allowPrivate: false }), false);
  });

  it('should return true for 172.15.x (not private — outside 172.16–172.31 range)', () => {
    // 172.15.x is NOT in private range (only 172.16–172.31)
    assert.equal(isPublicHttpUrl('http://172.15.0.1/', { allowPrivate: false }), true);
  });

  it('should return false for 192.168.x.x private class C', () => {
    assert.equal(isPublicHttpUrl('http://192.168.1.1/admin', { allowPrivate: false }), false);
  });

  it('should return false for 169.254.x.x link-local (AWS instance metadata)', () => {
    assert.equal(isPublicHttpUrl('http://169.254.169.254/latest/meta-data/', { allowPrivate: false }), false);
  });

  // ── IPv6 private ─────────────────────────────────────────────────────────
  it('should return false for IPv6 loopback ::1', () => {
    assert.equal(isPublicHttpUrl('http://[::1]/', { allowPrivate: false }), false);
  });

  it('should return false for IPv6 ULA fc00::1', () => {
    assert.equal(isPublicHttpUrl('http://[fc00::1]/', { allowPrivate: false }), false);
  });

  it('should return false for IPv6 ULA fd00::1', () => {
    assert.equal(isPublicHttpUrl('http://[fd00::1]/', { allowPrivate: false }), false);
  });

  it('should return false for IPv6 link-local fe80::1', () => {
    assert.equal(isPublicHttpUrl('http://[fe80::1]/', { allowPrivate: false }), false);
  });

  // ── Unsafe schemes (luôn bị chặn bất kể allowPrivate) ───────────────────
  it('should return false for ftp:// scheme regardless of allowPrivate', () => {
    assert.equal(isPublicHttpUrl('ftp://example.com/file.txt', { allowPrivate: true }), false);
  });

  it('should return false for file:// scheme regardless of allowPrivate', () => {
    assert.equal(isPublicHttpUrl('file:///etc/passwd', { allowPrivate: true }), false);
  });

  it('should return false for javascript: scheme regardless of allowPrivate', () => {
    assert.equal(isPublicHttpUrl('javascript:alert(1)', { allowPrivate: true }), false);
  });

  it('should return false for data: URI regardless of allowPrivate', () => {
    assert.equal(isPublicHttpUrl('data:text/html,<h1>XSS</h1>', { allowPrivate: true }), false);
  });

  // ── Bare hostname / special TLD ──────────────────────────────────────────
  it('should return false for bare hostname without dot (intranet)', () => {
    assert.equal(isPublicHttpUrl('http://intranet/resource', { allowPrivate: false }), false);
  });

  it('should return false for .local TLD', () => {
    assert.equal(isPublicHttpUrl('http://app.local/path', { allowPrivate: false }), false);
  });

  it('should return false for .internal TLD', () => {
    assert.equal(isPublicHttpUrl('http://service.internal/api', { allowPrivate: false }), false);
  });

  // ── Malformed / empty input ──────────────────────────────────────────────
  it('should return false for non-URL string', () => {
    assert.equal(isPublicHttpUrl('not-a-url'), false);
  });

  it('should return false for empty string', () => {
    assert.equal(isPublicHttpUrl(''), false);
  });
});


describe('URL Helper — isPrivateOrReservedHost', () => {
  it('should detect localhost', () => {
    assert.equal(isPrivateOrReservedHost('localhost'), true);
  });

  it('should detect 192.168.0.1', () => {
    assert.equal(isPrivateOrReservedHost('192.168.0.1'), true);
  });

  it('should NOT flag a public IP like 8.8.8.8', () => {
    assert.equal(isPrivateOrReservedHost('8.8.8.8'), false);
  });

  it('should NOT flag example.com', () => {
    assert.equal(isPrivateOrReservedHost('example.com'), false);
  });
});

describe('URL Helper — isValidHttpUrl (backward-compat)', () => {
  it('should return true for http://localhost (backward-compat, no private check)', () => {
    assert.equal(isValidHttpUrl('http://localhost'), true);
  });

  it('should return true for valid https URL', () => {
    assert.equal(isValidHttpUrl('https://example.com'), true);
  });

  it('should return false for ftp:// scheme', () => {
    assert.equal(isValidHttpUrl('ftp://example.com'), false);
  });

  it('should return false for invalid string', () => {
    assert.equal(isValidHttpUrl('not-a-url'), false);
  });
});

describe('URL Helper — extractDomain', () => {
  it('should extract hostname from valid URL', () => {
    assert.equal(extractDomain('https://api.example.com/v1/users'), 'api.example.com');
  });

  it('should return empty string for invalid URL', () => {
    assert.equal(extractDomain('not-a-url'), '');
  });

  it('should extract IPv4 from URL', () => {
    assert.equal(extractDomain('http://192.168.1.1:8080/'), '192.168.1.1');
  });
});

describe('SSRF Protection — isPrivateOrReservedIp', () => {
  it('should identify private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)', () => {
    assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('10.255.255.255'), true);
    assert.equal(isPrivateOrReservedIp('172.16.0.1'), true);
    assert.equal(isPrivateOrReservedIp('172.31.255.255'), true);
    assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
  });

  it('should identify loopback, unspecified, and cloud metadata IPv4 addresses', () => {
    assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('127.255.255.255'), true);
    assert.equal(isPrivateOrReservedIp('0.0.0.0'), true);
    assert.equal(isPrivateOrReservedIp('169.254.169.254'), true); // Cloud Metadata
    assert.equal(isPrivateOrReservedIp('100.64.0.1'), true); // Carrier-grade NAT
    assert.equal(isPrivateOrReservedIp('224.0.0.1'), true); // Multicast
    assert.equal(isPrivateOrReservedIp('255.255.255.255'), true); // Broadcast
  });

  it('should identify private IPv6 addresses and mapped IPv4 in IPv6', () => {
    assert.equal(isPrivateOrReservedIp('::1'), true); // IPv6 Loopback
    assert.equal(isPrivateOrReservedIp('::'), true); // IPv6 Unspecified
    assert.equal(isPrivateOrReservedIp('fc00::1'), true); // IPv6 ULA
    assert.equal(isPrivateOrReservedIp('fd12:3456::1'), true); // IPv6 ULA
    assert.equal(isPrivateOrReservedIp('fe80::1'), true); // IPv6 Link-local
    assert.equal(isPrivateOrReservedIp('ff02::1'), true); // IPv6 Multicast
    assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true); // IPv4-mapped loopback
    assert.equal(isPrivateOrReservedIp('::ffff:10.0.0.1'), true); // IPv4-mapped private
    assert.equal(isPrivateOrReservedIp('::ffff:169.254.169.254'), true); // IPv4-mapped metadata
  });

  it('should allow public IPv4 and IPv6 addresses', () => {
    assert.equal(isPrivateOrReservedIp('8.8.8.8'), false); // Google DNS
    assert.equal(isPrivateOrReservedIp('1.1.1.1'), false); // Cloudflare DNS
    assert.equal(isPrivateOrReservedIp('142.250.190.46'), false); // Google
    assert.equal(isPrivateOrReservedIp('2606:4700:4700::1111'), false); // Cloudflare IPv6
  });
});

describe('SSRF Protection — resolveAndValidateDns (DNS Rebinding Defense)', () => {
  it('should pass when domain resolves to public IP addresses', async () => {
    const mockLookup = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ];

    const result = await resolveAndValidateDns('example.com', {
      allowPrivate: false,
      dnsLookup: mockLookup,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.ips.length, 2);
  });

  it('should block when public domain resolves to private IPv4 (127.0.0.1)', async () => {
    const mockLookup = async () => [
      { address: '127.0.0.1', family: 4 },
    ];

    const result = await resolveAndValidateDns('attacker-local.com', {
      allowPrivate: false,
      dnsLookup: mockLookup,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('127.0.0.1'));
  });

  it('should block when public domain resolves to AWS metadata IP (169.254.169.254)', async () => {
    const mockLookup = async () => [
      { address: '169.254.169.254', family: 4 },
    ];

    const result = await resolveAndValidateDns('attacker-meta.com', {
      allowPrivate: false,
      dnsLookup: mockLookup,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('169.254.169.254'));
  });

  it('should block multi-homed domain if any single IP is private', async () => {
    const mockLookup = async () => [
      { address: '8.8.8.8', family: 4 }, // Public
      { address: '10.0.0.5', family: 4 }, // Private
    ];

    const result = await resolveAndValidateDns('multi-homed.com', {
      allowPrivate: false,
      dnsLookup: mockLookup,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('10.0.0.5'));
  });

  it('should allow private resolution when allowPrivate is explicitly true (dev mode)', async () => {
    const mockLookup = async () => [
      { address: '127.0.0.1', family: 4 },
    ];

    const result = await resolveAndValidateDns('localhost.test', {
      allowPrivate: true,
      dnsLookup: mockLookup,
    });

    assert.equal(result.isValid, true);
  });

  it('should return error when DNS lookup fails (NXDOMAIN / ENOTFOUND)', async () => {
    const mockLookup = async () => {
      throw new Error('getaddrinfo ENOTFOUND invalid-non-existent-domain.xyz');
    };

    const result = await resolveAndValidateDns('invalid-non-existent-domain.xyz', {
      dnsLookup: mockLookup,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('DNS resolution failed'));
  });
});

describe('SSRF Protection — resolveSafeRedirectChain (HTTP Redirect Chaining Defense)', () => {
  it('should pass for direct URL with no redirects (HTTP 200)', async () => {
    const mockLookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const mockFetcher = async () => ({ status: 200, headers: {} });

    const result = await resolveSafeRedirectChain('https://example.com/avatar.jpg', {
      allowPrivate: false,
      dnsLookup: mockLookup,
      httpFetcher: mockFetcher,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.finalUrl, 'https://example.com/avatar.jpg');
    assert.equal(result.redirectCount, 0);
  });

  it('should safely follow valid public redirect chain (HTTP 301 -> 302 -> 200)', async () => {
    const mockLookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const mockFetcher = async (url: string) => {
      if (url === 'https://step1.com/start') {
        return { status: 301, headers: { location: 'https://step2.com/middle' } };
      }
      if (url === 'https://step2.com/middle') {
        return { status: 302, headers: { location: 'https://final.com/resource' } };
      }
      return { status: 200, headers: {} };
    };

    const result = await resolveSafeRedirectChain('https://step1.com/start', {
      allowPrivate: false,
      dnsLookup: mockLookup,
      httpFetcher: mockFetcher,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.finalUrl, 'https://final.com/resource');
    assert.equal(result.redirectCount, 2);
    assert.equal(result.redirectChain.length, 3);
  });

  it('should block when public domain redirects to private IP (127.0.0.1 / localhost)', async () => {
    const mockLookup = async (host: string) => {
      if (host === 'evil-redirector.com') return [{ address: '93.184.216.34', family: 4 }];
      return [{ address: '127.0.0.1', family: 4 }];
    };

    const mockFetcher = async (url: string) => {
      if (url === 'https://evil-redirector.com/link') {
        return { status: 302, headers: { location: 'http://127.0.0.1:8888/admin' } };
      }
      return { status: 200, headers: {} };
    };

    const result = await resolveSafeRedirectChain('https://evil-redirector.com/link', {
      allowPrivate: false,
      dnsLookup: mockLookup,
      httpFetcher: mockFetcher,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('127.0.0.1') || result.reason?.includes('private'));
  });

  it('should block when public domain redirects to AWS Metadata IP (169.254.169.254)', async () => {
    const mockLookup = async (host: string) => {
      if (host === 'attacker.com') return [{ address: '93.184.216.34', family: 4 }];
      return [{ address: '169.254.169.254', family: 4 }];
    };

    const mockFetcher = async (url: string) => {
      if (url === 'https://attacker.com/meta') {
        return { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } };
      }
      return { status: 200, headers: {} };
    };

    const result = await resolveSafeRedirectChain('https://attacker.com/meta', {
      allowPrivate: false,
      dnsLookup: mockLookup,
      httpFetcher: mockFetcher,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('169.254.169.254') || result.reason?.includes('private'));
  });

  it('should block when redirect target uses disallowed protocol (file:, ftp:, javascript:)', async () => {
    const mockLookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const mockFetcher = async (url: string) => {
      if (url === 'https://attacker.com/file') {
        return { status: 302, headers: { location: 'file:///etc/passwd' } };
      }
      return { status: 200, headers: {} };
    };

    const result = await resolveSafeRedirectChain('https://attacker.com/file', {
      allowPrivate: false,
      dnsLookup: mockLookup,
      httpFetcher: mockFetcher,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('Disallowed protocol') || result.reason?.includes('file:'));
  });

  it('should detect and prevent circular redirect loops (A -> B -> A)', async () => {
    const mockLookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const mockFetcher = async (url: string) => {
      if (url === 'https://loop-a.com/start') {
        return { status: 302, headers: { location: 'https://loop-b.com/next' } };
      }
      if (url === 'https://loop-b.com/next') {
        return { status: 302, headers: { location: 'https://loop-a.com/start' } };
      }
      return { status: 200, headers: {} };
    };

    const result = await resolveSafeRedirectChain('https://loop-a.com/start', {
      allowPrivate: false,
      dnsLookup: mockLookup,
      httpFetcher: mockFetcher,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('Circular redirect loop'));
  });

  it('should block when redirect count exceeds maxRedirects limit', async () => {
    const mockLookup = async () => [{ address: '93.184.216.34', family: 4 }];
    let counter = 0;
    const mockFetcher = async () => {
      counter++;
      return { status: 302, headers: { location: `https://infinite-redirect.com/step-${counter}` } };
    };

    const result = await resolveSafeRedirectChain('https://infinite-redirect.com/start', {
      maxRedirects: 3,
      allowPrivate: false,
      dnsLookup: mockLookup,
      httpFetcher: mockFetcher,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.reason?.includes('Maximum redirect limit'));
  });

  it('should correctly resolve relative path redirect (/relative/target)', async () => {
    const mockLookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const mockFetcher = async (url: string) => {
      if (url === 'https://example.com/old/path') {
        return { status: 301, headers: { location: '/new/path' } };
      }
      return { status: 200, headers: {} };
    };

    const result = await resolveSafeRedirectChain('https://example.com/old/path', {
      allowPrivate: false,
      dnsLookup: mockLookup,
      httpFetcher: mockFetcher,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.finalUrl, 'https://example.com/new/path');
    assert.equal(result.redirectCount, 1);
  });
});

