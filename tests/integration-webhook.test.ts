import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptSecret,
  decryptSecret,
  generateApiKey,
  hashApiKey,
  signHmacSha256,
  verifyHmacSignature,
} from '../src/common/helpers/crypto.helper';
import {
  createApiKeySchema,
  createWebhookSchema,
  triggerJobSchema,
} from '../src/modules/integration/integration.validation';
import { WebhookWorker } from '../src/common/workers/webhook.worker';
import {
  WEBHOOK_STATUS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_DELIVERY_HEADER,
} from '../src/common/constants/integration.constant';

describe('Integration: AES-256-GCM Secret Encryption & Decryption', () => {
  it('should encrypt plaintext into IV:AuthTag:Cipher format and decrypt accurately', () => {
    const plainText = 'whsec_super_secret_signing_key_1234567890';
    const encrypted = encryptSecret(plainText);

    // Format should be 3 hex segments separated by colons
    const parts = encrypted.split(':');
    assert.equal(parts.length, 3);
    assert.notEqual(encrypted, plainText);
    assert.equal(encrypted.includes(plainText), false);

    // Decrypt
    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, plainText);
  });

  it('should fail decryption when ciphertext is tampered with (Auth Tag verification)', () => {
    const plainText = 'sensitive_webhook_secret_key';
    const encrypted = encryptSecret(plainText);
    const parts = encrypted.split(':');

    // Tamper with the ciphertext payload (preserving valid hex length)
    const lastByte = parts[2].slice(-2);
    const newByte = lastByte === 'aa' ? 'bb' : 'aa';
    const tamperedCipher = parts[2].slice(0, -2) + newByte;
    const tamperedEncrypted = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    assert.throws(() => {
      decryptSecret(tamperedEncrypted);
    });
  });

  it('should fail decryption when auth tag is invalid or tampered', () => {
    const plainText = 'another_secret_value';
    const encrypted = encryptSecret(plainText);
    const parts = encrypted.split(':');

    // Tamper with auth tag
    const fakeAuthTag = '00'.repeat(16);
    const tamperedEncrypted = `${parts[0]}:${fakeAuthTag}:${parts[2]}`;

    assert.throws(() => {
      decryptSecret(tamperedEncrypted);
    });
  });
});

describe('Integration: API Key Generation & SHA-256 Hashing', () => {
  it('should generate cryptographically random API Key with prefix and SHA-256 hash', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();

    assert.ok(key1.plainTextKey.startsWith('ak_live_'));
    assert.ok(key2.plainTextKey.startsWith('ak_live_'));
    assert.notEqual(key1.plainTextKey, key2.plainTextKey);
    assert.notEqual(key1.keyHash, key2.keyHash);

    // Hash should match deterministic SHA-256
    const manualHash = hashApiKey(key1.plainTextKey);
    assert.equal(key1.keyHash, manualHash);
    assert.equal(key1.keyHash.length, 64); // 256 bits in hex
  });
});

describe('Integration: HMAC-SHA256 Signing & Replay Attack Defense', () => {
  it('should generate valid HMAC-SHA256 signature in t=timestamp,v1=signature format', () => {
    const payload = JSON.stringify({ event: 'job.completed', data: { id: 100 } });
    const secret = 'whsec_test_secret_12345';
    const timestamp = Math.floor(Date.now() / 1000);

    const { signature, header } = signHmacSha256(payload, secret, timestamp);

    assert.ok(header.startsWith(`t=${timestamp},v1=`));
    assert.equal(header, `t=${timestamp},v1=${signature}`);
    assert.equal(signature.length, 64);

    // Verify signature
    const isValid = verifyHmacSignature(payload, header, secret, 300);
    assert.equal(isValid, true);
  });

  it('should reject signature when payload has been modified', () => {
    const originalPayload = JSON.stringify({ amount: 500 });
    const modifiedPayload = JSON.stringify({ amount: 999999 });
    const secret = 'whsec_secure_key';

    const { header } = signHmacSha256(originalPayload, secret);

    const isValid = verifyHmacSignature(modifiedPayload, header, secret);
    assert.equal(isValid, false);
  });

  it('should reject signature when timestamp exceeds tolerance window (Replay Attack Defense)', () => {
    const payload = JSON.stringify({ action: 'process_payment' });
    const secret = 'whsec_secure_key';
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s ago (> 300s tolerance)

    const { header } = signHmacSha256(payload, secret, oldTimestamp);

    // Verification with 300 seconds tolerance
    const isValid = verifyHmacSignature(payload, header, secret, 300);
    assert.equal(isValid, false);
  });
});

describe('Integration: Zod Validation & SSRF Protection', () => {
  it('should validate valid createApiKeySchema', () => {
    const valid = {
      name: 'Mobile Gateway',
      permissions: ['USER_READ'],
    };
    const result = createApiKeySchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('should validate valid public HTTPS Webhook URL', () => {
    const valid = {
      url: 'https://webhook.site/abc-123',
      events: ['job.completed'],
      description: 'Production webhook',
    };
    const result = createWebhookSchema.safeParse(valid);
    assert.equal(result.success, true);
  });

  it('should reject invalid private IP or localhost Webhook URL in production simulation', () => {
    const oldEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const invalidLocal = {
        url: 'http://127.0.0.1:8888/webhook',
      };
      const resultLocal = createWebhookSchema.safeParse(invalidLocal);
      assert.equal(resultLocal.success, false);

      const invalidMeta = {
        url: 'http://169.254.169.254/latest/meta-data/',
      };
      const resultMeta = createWebhookSchema.safeParse(invalidMeta);
      assert.equal(resultMeta.success, false);
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });

  it('should validate triggerJobSchema', () => {
    const valid = {
      taskName: 'generate_financial_statement',
      data: { year: 2026 },
      simulateError: false,
    };
    const result = triggerJobSchema.safeParse(valid);
    assert.equal(result.success, true);
  });
});

import { integrationRepository } from '../src/modules/integration/integration.repository';

describe('Integration: Webhook Dispatcher & Delivery Worker Execution', () => {
  it('should decrypt secret, sign HMAC header, and successfully execute HTTP POST delivery', async () => {
    // Stub repository update to prevent remote DB call during unit test
    (integrationRepository as any).updateDeliveryStatus = async () => ({} as any);

    const plainSecret = 'whsec_client_secret_xyz123';

    const encryptedSecret = encryptSecret(plainSecret);
    const worker = new WebhookWorker();


    let capturedHeaders: Record<string, string> = {};
    let capturedBody: string = '';

    const mockFetcher = async (url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>;
      capturedBody = init.body as string;
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const jobData = {
      deliveryId: '11111111-2222-3333-4444-555555555555',
      webhookEndpointId: '66666666-7777-8888-9999-000000000000',
      userId: 'user-test-123',
      event: 'job.completed',
      url: 'https://client.example.com/webhook',
      encryptedSecret,
      payload: { jobId: 'job_999', status: 'SUCCESS' },
    };

    const result = await worker.processJob(jobData, 0, mockFetcher);

    assert.equal(result.success, true);
    assert.equal(result.statusCode, 200);

    // Verify sent headers
    assert.equal(capturedHeaders[WEBHOOK_EVENT_HEADER], 'job.completed');
    assert.equal(capturedHeaders[WEBHOOK_DELIVERY_HEADER], jobData.deliveryId);
    assert.ok(capturedHeaders[WEBHOOK_SIGNATURE_HEADER]);

    // Verify HMAC signature on receiver side
    const isSignatureValid = verifyHmacSignature(
      capturedBody,
      capturedHeaders[WEBHOOK_SIGNATURE_HEADER],
      plainSecret,
    );
    assert.equal(isSignatureValid, true);
  });

  it('should halt delivery and return error if target URL fails SSRF check', async () => {
    (integrationRepository as any).updateDeliveryStatus = async () => ({} as any);
    const oldEnv = process.env.NODE_ENV;


    try {
      process.env.NODE_ENV = 'production';
      const plainSecret = 'whsec_client_secret_xyz123';
      const encryptedSecret = encryptSecret(plainSecret);
      const worker = new WebhookWorker();

      const maliciousJobData = {
        deliveryId: '22222222-3333-4444-5555-666666666666',
        webhookEndpointId: '77777777-8888-9999-0000-111111111111',
        userId: 'user-test-123',
        event: 'job.completed',
        url: 'http://127.0.0.1:8888/internal/steal',
        encryptedSecret,
        payload: { test: true },
      };

      const result = await worker.processJob(maliciousJobData, 0);

      assert.equal(result.success, false);
      assert.ok(result.error?.includes('SSRF Check Failed'));
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });
});
