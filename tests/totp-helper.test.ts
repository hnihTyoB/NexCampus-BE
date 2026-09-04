import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateOtpauthUri,
  generateTotpCode,
  verifyTotpCode,
  generateBackupCodes,
} from "../src/common/helpers/totp.helper";
import { hashToken } from "../src/common/helpers/crypto.helper";

describe("TOTP Helper Unit Test Suite (RFC 6238 / RFC 4226)", () => {
  describe("1. Base32 Encoding & Decoding", () => {
    it("should round-trip encode and decode arbitrary buffers correctly", () => {
      const testCases = [
        "hello world",
        "Authentication Secret 12345!",
        "RFC 6238 test string",
        "",
      ];

      for (const str of testCases) {
        const buf = Buffer.from(str, "utf8");
        const encoded = base32Encode(buf);
        const decoded = base32Decode(encoded);
        assert.equal(decoded.toString("utf8"), str);
      }
    });

    it("should handle lowercase, spaces, and dashes gracefully during decoding", () => {
      const secret = "JBSWY3DPEHPK3PXP"; // Base32 for "Hello!\xde\xad\xbe\xef"
      const withFormatting = "jbsw y3dp - ehpk 3pxp";
      const decoded1 = base32Decode(secret);
      const decoded2 = base32Decode(withFormatting);
      assert.deepEqual(decoded1, decoded2);
    });

    it("should throw error on invalid base32 characters", () => {
      assert.throws(
        () => base32Decode("INVALID_CHARS_890!"),
        /Invalid base32 character/,
      );
    });
  });

  describe("2. Secret & URI Generation", () => {
    it("generateTotpSecret should return 32-character Base32 string (20 bytes / 160 bits)", () => {
      const secret = generateTotpSecret(20);
      assert.equal(typeof secret, "string");
      assert.equal(secret.length, 32);
      assert.match(secret, /^[A-Z2-7]+$/);
    });

    it("generateOtpauthUri should construct valid URI for authenticator QR code", () => {
      const uri = generateOtpauthUri({
        issuer: "TemplateBE",
        accountName: "user@example.com",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assert.ok(
        uri.startsWith("otpauth://totp/TemplateBE:user%40example.com?"),
      );
      assert.ok(uri.includes("secret=JBSWY3DPEHPK3PXP"));
      assert.ok(uri.includes("issuer=TemplateBE"));
      assert.ok(uri.includes("algorithm=SHA1"));
      assert.ok(uri.includes("digits=6"));
      assert.ok(uri.includes("period=30"));
    });
  });

  describe("3. RFC 6238 / RFC 4226 TOTP Generation & Verification", () => {
    const secret = "JBSWY3DPEHPK3PXP";

    it("should generate 6-digit numeric string", () => {
      const code = generateTotpCode(secret);
      assert.equal(typeof code, "string");
      assert.equal(code.length, 6);
      assert.match(code, /^\d{6}$/);
    });

    it("should produce identical codes within the same 30-second window", () => {
      const windowStart = 56666667 * 30000; // 1700000010000 ms
      const t1 = windowStart + 2000; // 2s into window
      const t2 = windowStart + 18000; // 18s into same window
      const code1 = generateTotpCode(secret, t1);
      const code2 = generateTotpCode(secret, t2);
      assert.equal(code1, code2);
    });

    it("verifyTotpCode should accept exact code at current timestamp", () => {
      const now = Date.now();
      const code = generateTotpCode(secret, now);
      assert.equal(verifyTotpCode(secret, code, 1, now), true);
    });

    it("verifyTotpCode should accept code with window drift of +30s and -30s", () => {
      const now = 1700000000000;
      const codeMinus30s = generateTotpCode(secret, now - 30000);
      const codePlus30s = generateTotpCode(secret, now + 30000);

      assert.equal(verifyTotpCode(secret, codeMinus30s, 1, now), true);
      assert.equal(verifyTotpCode(secret, codePlus30s, 1, now), true);
    });

    it("verifyTotpCode should reject code outside the drift window (> 60s)", () => {
      const now = 1700000000000;
      const codeTooOld = generateTotpCode(secret, now - 90000); // 90s ago
      const codeTooFuture = generateTotpCode(secret, now + 90000); // 90s future

      assert.equal(verifyTotpCode(secret, codeTooOld, 1, now), false);
      assert.equal(verifyTotpCode(secret, codeTooFuture, 1, now), false);
    });

    it("verifyTotpCode should reject malformed or wrong codes", () => {
      assert.equal(verifyTotpCode(secret, "000000"), false);
      assert.equal(verifyTotpCode(secret, "abc123"), false);
      assert.equal(verifyTotpCode(secret, "12345"), false);
      assert.equal(verifyTotpCode(secret, "1234567"), false);
    });
  });

  describe("4. Backup Recovery Codes Generation", () => {
    it("generateBackupCodes should produce 8 formatted codes and matching SHA-256 hashes", () => {
      const { plainCodes, hashedCodes } = generateBackupCodes(8);

      assert.equal(plainCodes.length, 8);
      assert.equal(hashedCodes.length, 8);

      for (let i = 0; i < 8; i++) {
        const code = plainCodes[i];
        assert.match(
          code,
          /^[0-9A-F]{4}-[0-9A-F]{4}$/,
          "Code must follow xxxx-xxxx format",
        );
        assert.equal(
          hashToken(code),
          hashedCodes[i],
          "Hashed code must match SHA-256 of plain code",
        );
      }

      // Check all codes are unique
      const unique = new Set(plainCodes);
      assert.equal(unique.size, 8);
    });
  });
});
