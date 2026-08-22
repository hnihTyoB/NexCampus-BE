import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from '../src/modules/auth/auth.validation';
import { createUserSchema, userIdParamSchema } from '../src/modules/users/user.validation';

describe('Auth & User Validation Schemas', () => {
  it('should allow valid non-gmail email addresses during registration', () => {
    const validInputs = [
      { email: 'user@outlook.com', password: 'Password@123', fullName: 'Nguyen Van A' },
      { email: 'user@template.local', password: 'Password@123', fullName: 'Admin' },
      { email: 'user@company.vn', password: 'Password@123', fullName: 'User VN' },
      { email: 'user@gmail.com', password: 'Password@123', fullName: 'Gmail User' },
    ];

    for (const input of validInputs) {
      const result = registerSchema.safeParse(input);
      assert.equal(result.success, true, `Expected ${input.email} to be valid`);
    }
  });

  it('should reject invalid password format during registration', () => {
    const invalidInputs = [
      { email: 'user@example.com', password: 'short', fullName: 'Short Pass' }, // < 8 chars
      { email: 'user@example.com', password: 'alllowercase123!', fullName: 'No Upper' }, // no uppercase
      { email: 'user@example.com', password: 'ALLUPPERCASE123!', fullName: 'No Lower' }, // no lowercase
      { email: 'user@example.com', password: 'NoNumberPass!@#', fullName: 'No Number' }, // no number
      { email: 'user@example.com', password: 'NoSpecialChar1234', fullName: 'No Special' }, // no special char
    ];

    for (const input of invalidInputs) {
      const result = registerSchema.safeParse(input);
      assert.equal(result.success, false, `Expected password "${input.password}" to fail`);
    }
  });

  it('should validate UUID format in userIdParamSchema', () => {
    const validUuid = { id: '123e4567-e89b-12d3-a456-426614174000' };
    const invalidUuid = { id: 'not-a-valid-uuid-1234' };

    assert.equal(userIdParamSchema.safeParse(validUuid).success, true);
    assert.equal(userIdParamSchema.safeParse(invalidUuid).success, false);
  });

  it('should validate createUserSchema with any valid email and UUID roleId', () => {
    const validData = {
      email: 'manager@template.local',
      password: 'Manager@123456',
      roleId: '123e4567-e89b-12d3-a456-426614174000',
    };

    const result = createUserSchema.safeParse(validData);
    assert.equal(result.success, true);
  });
});
