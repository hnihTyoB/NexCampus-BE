import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { getVietnamDayRange, formatVietnamDate } from '../src/common/helpers/date.helper';
import { toSlug } from '../src/common/helpers/slug.helper';
import { generateDeviceHash } from '../src/common/helpers/user-agent.helper';

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
