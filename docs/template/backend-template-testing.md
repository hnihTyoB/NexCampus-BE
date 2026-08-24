# Backend Template Testing Guide

**Repository**: `template-be`  
**Test Runner**: Node Native Test Runner (`node:test`) + `tsx`  
**Execution Command**: `pnpm test`  

---

## 1. Test Suite Overview

The automated test suite covers all core infrastructure layers without relying on heavy external dependencies:

```text
tests/
├── auth-validation.test.ts          # Zod validation schemas (Register, Login, UUIDs, Passwords)
├── audit-remediation.test.ts        # Prisma error mappings, pagination shapes, rate limiter headers
├── helpers.test.ts                  # URL helper, SSRF protection, DNS rebinding, redirect loops, crypto, timezones
├── rbac.test.ts                     # Dynamic RBAC permissions, role sync, anti-lockout protection
├── maintenance.test.ts              # System maintenance guard, read-only mode, IP whitelists, Redis cache invalidation
├── notification-template.test.ts    # Template rendering, variable interpolation, fallback layouts
├── integration-webhook.test.ts      # API Key generation & SHA-256 hash, AES-256-GCM encryption, HMAC signatures, Webhook worker
├── system-config.test.ts            # Dynamic system config CRUD, caching, feature flags evaluation, route gating
└── observability.test.ts            # Request ID correlation middleware (X-Request-Id)
```

---

## 2. Test Execution

```bash
# Run all tests
pnpm test

# Run a specific test suite
node --test --import tsx tests/system-config.test.ts

# Run tests with detailed TAP output
pnpm test -- --reporter=tap
```

---

## 3. Failure & Resilience Verification

The test suite explicitly verifies:
- **SSRF Attacks**: Private IPs, AWS metadata IPs, redirect loops, and DNS rebinding domains are rejected.
- **HMAC Replay Attacks**: Tampered signatures or requests outside the timestamp tolerance window fail verification.
- **Crypto Tampering**: Tampered AES-256-GCM ciphertexts or auth tags throw authentication errors.
- **Anti-Lockout Invariants**: The `ADMIN` role cannot lose `ROLE_PERMISSION_ASSIGN`.
- **System Maintenance Exemption**: Protected admin and health endpoints remain accessible during maintenance.
- **Rate Limit Breaches**: Returns 429 with accurate `Retry-After` and `X-RateLimit-*` headers.
