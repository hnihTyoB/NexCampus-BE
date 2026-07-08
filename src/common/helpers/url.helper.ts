import * as dns from 'dns';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';

// ---------------------------------------------------------------------------
// Static IP-based patterns (sync, fast path)
// ---------------------------------------------------------------------------

const PRIVATE_IP_PATTERNS: RegExp[] = [
  // --- IPv4 ---
  /^localhost$/i,
  /^127\./,                                        // 127.0.0.0/8 — full loopback range
  /^10\./,                                         // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,                   // 172.16.0.0/12
  /^192\.168\./,                                   // 192.168.0.0/16
  /^169\.254\./,                                   // link-local + AWS metadata
  /^0\.0\.0\.0$/,                                  // maps to localhost on most systems
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,    // 100.64.0.0/10 — CGNAT (RFC 6598)
  /^192\.0\.2\./,                                  // 192.0.2.0/24 — TEST-NET-1 (RFC 5737)
  /^198\.51\.100\./,                               // 198.51.100.0/24 — TEST-NET-2 (RFC 5737)
  /^203\.0\.113\./,                                // 203.0.113.0/24 — TEST-NET-3 (RFC 5737)
  /^198\.1[89]\./,                                 // 198.18.0.0/15 — benchmarking (RFC 2544)

  // --- IPv6 ---
  /^\[?::1\]?$/,                                   // loopback
  /^\[?::\]?$/,                                    // unspecified
  /^\[?fc[0-9a-f]{2}:/i,                          // ULA fc00::/7 (fc prefix)
  /^\[?fd[0-9a-f]{2}:/i,                          // ULA fd00::/8 (fd prefix)
  /^\[?fe[89ab][0-9a-f]:/i,                       // link-local fe80::/10
  /^\[?2001:db8:/i,                               // 2001:db8::/32 — documentation (RFC 3849)
  /^\[?ff[0-9a-f]{2}:/i,                          // ff00::/8 — multicast

  // IPv4-mapped IPv6 — block all ::ffff: mapped addresses, since legitimate
];

  // Strict IPv4 literal check — validates each octet is 0-255.
  // The naive /^\d{1,3}(\.\d{1,3}){3}$/ matches 999.999.999.999.
 
function isIPv4Literal(hostname: string): boolean {
  return /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(
    hostname,
  );
}

/** IPv6 literal — bracketed or raw colon-hex form. */
function isIPv6Literal(hostname: string): boolean {
  return /^\[?[0-9a-f:]+\]?$/i.test(hostname);
}

function checkAgainstPrivatePatterns(address: string): boolean {
  const stripped = address.replace(/^\[|\]$/g, ''); // remove brackets
  
  // IPv4-mapped IPv6: ::ffff:x.x.x.x or compressed hex form
  // Extract embedded IPv4 if present in dotted form
  const ipv4MappedDotted = stripped.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedDotted) {
    return PRIVATE_IP_PATTERNS.some((p) => p.test(ipv4MappedDotted[1]));
  }
  // IPv4-mapped in compressed hex: ::ffff:7f00:1 etc — block all ::ffff: mapped
  // Rather than decode hex octets, block the entire ::ffff: space since
  // legitimate public traffic doesn't use IPv4-mapped IPv6 addressing.
  if (/^::ffff:/i.test(stripped)) {
    return true;
  }

  return PRIVATE_IP_PATTERNS.some((p) => p.test(stripped));
}


// Sync validation — static IPs and protocol only.
// Cannot block DNS rebinding. Use validateUrlAsync() at every call site that
// accepts user-supplied URLs.

export function validateUrl(url: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('Invalid URL format', 400, ERROR_CODE.INVALID_URL);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError(
      'Only HTTP and HTTPS URLs are allowed',
      400,
      ERROR_CODE.INVALID_URL,
    );
  }

  const hostname = parsed.hostname;

  if (checkAgainstPrivatePatterns(hostname)) {
    throw new AppError(
      'Private or local IP addresses are not allowed',
      403,
      ERROR_CODE.PRIVATE_IP_BLOCKED,
    );
  }

  return parsed;
}

// Async validation — extends sync with DNS resolution.
// Uses { all: true } to resolve ALL addresses for a hostname (both IPv4 and
// IPv6). Blocks if ANY resolved address is private — prevents SSRF via DNS
// rebinding on dual-stack hosts.
// TOCTOU note: validate as close to the actual HTTP request as possible
// (i.e. inside the worker, not only at job creation time). DNS TTL can expire
// between validation and the Firecrawl request.

export async function validateUrlAsync(url: string): Promise<URL> {
  const parsed = validateUrl(url); // sync checks first

  const hostname = parsed.hostname;

  if (isIPv4Literal(hostname) || isIPv6Literal(hostname)) {
    return parsed;
  }

  const addresses = await new Promise<dns.LookupAddress[]>((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addrs) => {
      if (err) {
        reject(new AppError('DNS resolution failed', 400, ERROR_CODE.INVALID_URL));
      } else {
        resolve(addrs);
      }
    });
  });

  if (addresses.length === 0) {
    throw new AppError('DNS resolution returned no addresses', 400, ERROR_CODE.INVALID_URL);
  }

  for (const { address } of addresses) {
    if (checkAgainstPrivatePatterns(address)) {
      throw new AppError(
        'URL resolves to a private or reserved IP address',
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