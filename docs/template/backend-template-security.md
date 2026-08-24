# Backend Template Security & Hardening Reference

**Repository**: `template-be`  
**Security Level**: Production Hardened  

---

## 1. Authentication & Token Security
- **Password Hashing**: Bcrypt with salt work factor 10. Passwords are never stored in plaintext, logged, or returned in API responses.
- **JWT Architecture**:
  - Access Token: Short-lived (15 minutes).
  - Refresh Token: Long-lived (7 days), stored in database, rotated on every refresh invocation (Single-Use Refresh Tokens).
  - JTI (JWT ID): Every refresh token has a cryptographically unique `jti` to prevent token collisions.
- **Session Revocation**: Changing password or resetting password terminates all active refresh tokens in a database transaction (`$transaction`).

## 2. Dynamic Authorization & RBAC
- **No Hard-Coded Business Roles**: All business endpoints are protected by `requirePermission(PERMISSIONS.XXX)` or `requireAnyPermission(...)`.
- **System Role Protection**: System roles cannot be renamed or deleted.
- **Anti-Lockout Protection**: System prevents revocation of `ROLE_PERMISSION_ASSIGN` from the `ADMIN` role.
- **Cache Invalidation**: Role and permission updates instantly purge cached permissions across memory and clusters.

## 3. Input Validation & Parameter Tampering
- **Zod HTTP Gateway**: Every incoming HTTP request must pass Zod schema validation before hitting controllers.
- **Mass Assignment Defense**: Schemas strictly whitelist assignable fields. Privileged fields like `roleId`, `isActive`, `isSystem` are stripped or rejected on self-service endpoints.
- **UUID Validation**: All ID route parameters enforce strict UUID v4 formatting.

## 4. Advanced Anti-SSRF Defense (`src/common/helpers/url.helper.ts`)
- **Protocol Whitelist**: Only `http:` and `https:` protocols are accepted. `file:`, `ftp:`, `javascript:`, and `data:` URIs are rejected.
- **Private & Cloud Metadata IP Filtering**:
  - Blocks IPv4 Private: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
  - Blocks Loopback & Unspecified: `127.0.0.0/8`, `0.0.0.0/8`.
  - Blocks Link-Local / Cloud Metadata: `169.254.0.0/16` (AWS/GCP/Azure instance metadata endpoint `169.254.169.254`).
  - Blocks CGN & Broadcast: `100.64.0.0/10`, `224.0.0.0/4`, `255.255.255.255`.
  - Blocks IPv6 Loopback / ULA / Link-Local / IPv4-mapped IPv6 (`::1`, `fc00::/7`, `fe80::/10`, `::ffff:127.0.0.1`, `::ffff:169.254.169.254`).
- **DNS Rebinding Defense**: `resolveAndValidateDns()` resolves all A and AAAA DNS records and verifies none point to private addresses.
- **Redirect Chaining Defense**: `resolveSafeRedirectChain()` inspects every hop of HTTP 301/302/307/308 redirects up to 5 steps, blocking circular loops or redirection to internal resources.

## 5. Secret Encryption & HMAC Webhook Signatures
- **AES-256-GCM Encryption**: Webhook secrets and sensitive credentials are encrypted using authenticated AES-256-GCM (`IV:AuthTag:Ciphertext`), guaranteeing confidentiality and tamper-detection.
- **HMAC-SHA256 Signatures**: Outbound webhooks include `X-Webhook-Signature` (`t=timestamp,v1=hexSignature`). Receivers verify signatures with a 5-minute replay attack defense window.
- **API Key Hashing**: Plaintext API keys are returned once upon generation; database stores only SHA-256 hashes (`keyHash`).

## 6. Multi-Tier Rate Limiting & Denial of Service Defense
- **Global Rate Limiter**: 1000 requests / 15 minutes per IP.
- **Auth Endpoint Limiter**: 30 requests / 15 minutes per IP for `/register`, `/login`, `/forgot-password`, `/reset-password`, `/resend-verification`.
- **RFC 6585 Headers**: Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on 429 responses.
- **Memory Safety**: Automatic periodic eviction prevents memory leaks from expired client IP trackers.

## 7. CORS & Production Header Hardening
- **Production CORS Fail-Safe**: Rejects wildcard `'*'` in production; requires explicit domain list in `ALLOWED_ORIGINS`.
- **Helmet Headers**: Automatically secures HTTP response headers against XSS, clickjacking, and MIME sniffing.
- **Error Obfuscation**: Global error handler intercepts database errors (`P2002`, `P2025`, `P2003`), returning sanitized API messages and masking SQL queries, stack traces, and environment variables.
